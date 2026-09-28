import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { closeDb, initDatabase } from '../db'
import { addMessage, createConversation } from '../data/conversations'
import { getDigest } from '../data/digests'
import { createMemory, listMemories } from '../data/memories'
import { updateSettings } from '../settings'
import { embedText } from './embeddings'
import { processConversation } from './memoryProcessor'

vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})
vi.mock('./embeddings', () => ({ embedText: vi.fn() }))

const mockGenerateText = vi.mocked(generateText)
const mockEmbed = vi.mocked(embedText)

function reply(json: unknown): void {
  mockGenerateText.mockResolvedValueOnce({ text: JSON.stringify(json) } as never)
}

// Metne göre sabit bir vektör: aynı anahtar kelimeyi içerenler birbirine çok benzer
function fakeVector(text: string): Float32Array {
  const lower = text.toLocaleLowerCase('tr-TR')
  return new Float32Array([
    lower.includes('kahve') ? 1 : 0,
    lower.includes('elif') ? 1 : 0,
    lower.includes('antalya') ? 1 : 0,
    lower.includes('şekersiz') ? 0.3 : 0,
    lower.includes('sütlü') ? 0.5 : 0,
    0.01
  ])
}

beforeEach(() => {
  initDatabase(':memory:')
  updateSettings({ provider: 'google', models: { ollama: 'qwen3:14b' } })
  mockGenerateText.mockReset()
  mockEmbed.mockReset()
  mockEmbed.mockImplementation(async (text) => fakeVector(text))
})

afterEach(() => closeDb())

function conversationWith(...lines: string[]): number {
  const conversation = createConversation()
  lines.forEach((line, i) => addMessage(conversation.id, i % 2 === 0 ? 'user' : 'assistant', line))
  return conversation.id
}

describe('processConversation', () => {
  it('bilgileri otomatik, türlü ve gözden geçirilmemiş kaydeder, özeti yazar', async () => {
    const id = conversationWith('Kızımın adı Elif, Ekim’de Antalya’ya gidiyoruz', 'Harika!')
    reply({
      ozet: 'Kullanıcı ailesiyle Antalya tatilini anlattı.',
      bilgiler: [
        { tur: 'kisi', metin: 'Kullanıcının kızının adı Elif.' },
        { tur: 'plan', metin: 'Kullanıcı Ekim’de Antalya’ya gidecek.' }
      ]
    })

    const result = await processConversation(id)

    expect(result).toEqual({ added: 2, updated: 0, summarized: true })
    expect(listMemories()).toEqual([
      expect.objectContaining({
        kind: 'kisi',
        source: 'otomatik',
        reviewed: false,
        sourceConversationId: id
      }),
      expect.objectContaining({ kind: 'plan', content: 'Kullanıcı Ekim’de Antalya’ya gidecek.' })
    ])
    expect(getDigest(id)?.summary).toBe('Kullanıcı ailesiyle Antalya tatilini anlattı.')
  })

  it('bulut modeli seçiliyken bile yerel (Ollama) modeli kullanır', async () => {
    const id = conversationWith('Merhaba', 'Selam')
    reply({ ozet: 'Selamlaşma.', bilgiler: [] })
    await processConversation(id)
    const model = mockGenerateText.mock.calls[0][0].model as { provider: string; modelId: string }
    expect(model.provider).toContain('ollama')
    expect(model.modelId).toBe('qwen3:14b')
  })

  it('anlamca aynı bilgiyi tekrar açmaz, benzerini günceller', async () => {
    createMemory('Kullanıcı kahveyi şekersiz içer.')
    // Mevcut kaydın embedding'i yok; işleyici kök benzerliğine düşmesin diye önce vektör verelim
    const id = conversationWith('Kahvemi artık sütlü içiyorum', 'Not aldım')
    reply({
      ozet: 'Kahve tercihi değişti.',
      bilgiler: [{ tur: 'tercih', metin: 'Kullanıcı kahveyi sütlü içer.' }]
    })

    const result = await processConversation(id)

    expect(result.added + result.updated).toBe(1)
    expect(listMemories()).toHaveLength(1)
  })

  it('yeni mesaj yoksa modeli çağırmaz; yeni mesajda önceki özeti de verir', async () => {
    const id = conversationWith('Merhaba', 'Selam')
    reply({ ozet: 'Selamlaşma.', bilgiler: [] })
    await processConversation(id)
    await processConversation(id)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)

    addMessage(id, 'user', 'Kızımın adı Elif')
    reply({ ozet: 'Selamlaştı, kızından bahsetti.', bilgiler: [] })
    await processConversation(id)
    const prompt = mockGenerateText.mock.calls[1][0].prompt as string
    expect(prompt).toContain('Selamlaşma.')
    expect(prompt).toContain('Kızımın adı Elif')
    expect(prompt).not.toContain('Kullanıcı: Merhaba')
  })

  it('ayrıştırılamayan cevapta veri bozulmaz; 3 denemeden sonra o kısım atlanır', async () => {
    const id = conversationWith('Merhaba', 'Selam')
    mockGenerateText.mockResolvedValue({ text: 'anlamadım' } as never)
    await processConversation(id)
    await processConversation(id)
    expect(getDigest(id)).toBeNull()
    await processConversation(id)
    expect(getDigest(id)?.processedUntil).toBeGreaterThan(0)
    expect(listMemories()).toEqual([])
  })

  it('embedding servisi yoksa yine kaydeder (kök benzerliğiyle tekilleştirir)', async () => {
    mockEmbed.mockRejectedValue(new Error('Ollama yok'))
    const id = conversationWith('Kızımın adı Elif', 'Güzel isim')
    reply({ ozet: 'x', bilgiler: [{ tur: 'kisi', metin: 'Kullanıcının kızının adı Elif.' }] })
    expect((await processConversation(id)).added).toBe(1)
  })

  it('model hatasında hata fırlatır (zamanlayıcı sonra yeniden dener)', async () => {
    const id = conversationWith('Merhaba', 'Selam')
    mockGenerateText.mockRejectedValue(new Error('Ollama kapalı'))
    await expect(processConversation(id)).rejects.toThrow('Ollama kapalı')
    expect(getDigest(id)).toBeNull()
  })
})
