import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { generateText, streamText } from 'ai'
import { closeDb, initDatabase } from '../db'
import { createConversation, listMessages } from '../data/conversations'
import { getSettings, updateSettings } from '../settings'
import { editAndResend, regenerateReply, sendMessage, stopChat } from './chat'
import type { ChatEvent } from '../../shared/api'

// Gerçek pencere yok; "veri değişti" olayı test için önemli değil
vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))

// streamText/generateText testte gerçek modele gitmez; her test kendi akışını verir
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, streamText: vi.fn(), generateText: vi.fn() }
})

const mockStreamText = vi.mocked(streamText)
const mockGenerateText = vi.mocked(generateText)

beforeEach(() => {
  initDatabase(':memory:')
  // getModel() bir model seçilmemişse hemen hata verir; varsayılan Ollama modeli boş
  updateSettings({ models: { ollama: 'qwen3:14b' } })
  mockStreamText.mockReset()
  mockGenerateText.mockReset()
  // Başlık/özet üretimi testlerde çağrılırsa boş dönüp sessizce yok sayılsın
  mockGenerateText.mockResolvedValue({ text: '' } as never)
})

afterEach(() => closeDb())

type Part = Record<string, unknown>

function streamOf(parts: Part[]): AsyncGenerator<Part> {
  return (async function* () {
    for (const part of parts) yield part
  })()
}

function fakeSender(events: ChatEvent[]): WebContents {
  return {
    isDestroyed: () => false,
    send: (_channel: string, event: ChatEvent) => events.push(event)
  } as unknown as WebContents
}

async function waitFor(check: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Beklenen durum oluşmadı (zaman aşımı).')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('sendMessage', () => {
  it('metni parça parça akıtır ve tamamlanınca asistan mesajını kaydeder', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        { type: 'text-delta', text: 'Merhaba' },
        { type: 'text-delta', text: ', nasılsın?' }
      ])
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Selam')

    await waitFor(() => events.some((e) => e.type === 'done'))

    const deltas = events
      .filter((e) => e.type === 'delta')
      .map((e) => (e as never as { text: string }).text)
    expect(deltas.join('')).toBe('Merhaba, nasılsın?')

    const messages = listMessages(conversation.id)
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Merhaba, nasılsın?' })
  })

  it('model seçilmemişse mesajı kaydetmeden hemen hata fırlatır', () => {
    updateSettings({ models: { ollama: '' } })
    const conversation = createConversation()
    expect(() => sendMessage(fakeSender([]), conversation.id, 'Selam')).toThrow(
      'Henüz bir model seçilmedi'
    )
    expect(listMessages(conversation.id)).toHaveLength(0)
  })

  it('boş mesajı reddeder', () => {
    const conversation = createConversation()
    expect(() => sendMessage(fakeSender([]), conversation.id, '   ')).toThrow('Boş mesaj')
  })

  it('aynı sohbette cevap yazılırken ikinci isteği reddeder', async () => {
    mockStreamText.mockReturnValue({ stream: streamOf([]) } as never)
    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'İlk soru')
    expect(() => sendMessage(fakeSender([]), conversation.id, 'İkinci soru')).toThrow(
      'zaten bir cevap yazılıyor'
    )
    // Sonraki testlere sızmasın: bu isteğin de bitmesini bekle
    await waitFor(() => events.some((e) => e.type === 'error'))
  })

  it('araç çağrısını işlem geçmişine ve son mesaja kaydeder', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'gorev_ekle',
          input: { baslik: 'Test' }
        },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'gorev_ekle',
          output: { id: 1, baslik: 'Test' }
        },
        { type: 'text-delta', text: 'Ekledim.' }
      ])
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Listeme test ekle')

    await waitFor(() => events.some((e) => e.type === 'done'))

    const toolEvents = events.filter((e) => e.type === 'tool')
    expect(
      toolEvents.map((e) => (e as never as { activity: { status: string } }).activity.status)
    ).toEqual(['running', 'done'])

    const messages = listMessages(conversation.id)
    expect(messages[1].tools).toEqual([
      expect.objectContaining({ name: 'gorev_ekle', status: 'done' })
    ])
  })

  it('model hata bildirirse Türkçe hata mesajıyla biter, o ana kadarki metin kaybolmaz', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        { type: 'text-delta', text: 'Yazarken ' },
        { type: 'error', error: new Error('bağlantı koptu') }
      ])
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Soru')

    await waitFor(() => events.some((e) => e.type === 'error'))

    const errorEvent = events.find((e) => e.type === 'error') as never as {
      error: string
      message: { content: string } | null
    }
    expect(errorEvent.error).toEqual(expect.any(String))
    expect(errorEvent.error.length).toBeGreaterThan(0)
    expect(errorEvent.message?.content).toBe('Yazarken ')
    expect(listMessages(conversation.id)[1]).toMatchObject({ content: 'Yazarken ' })
  })

  it('sesli kaynaktan gelen cevapta talimata sesli konuşma kuralları eklenir', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([{ type: 'text-delta', text: 'Tamam.' }])
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Bugün hava nasıl?', { source: 'voice' })

    await waitFor(() => events.some((e) => e.type === 'done'))
    const call = mockStreamText.mock.calls[0][0] as { instructions: string }
    expect(call.instructions).toContain('SESLİ konuşuyorsun')
  })

  it('Google bağlı değilse talimatta Gmail/Takvim araçlarından bahsetmez', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([{ type: 'text-delta', text: 'Tamam.' }])
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Selam')

    await waitFor(() => events.some((e) => e.type === 'done'))
    const call = mockStreamText.mock.calls[0][0] as { instructions: string }
    expect(call.instructions).toContain('Google hesabı bağlı değil')
    expect(call.instructions).not.toContain('Gmail ve Google Takvim araçların var')
  })
})

describe('stopChat', () => {
  it('durdurulan sohbette yarım kalan metni kaydeder ve "stopped" olayı gönderir', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    mockStreamText.mockReturnValue({
      stream: (async function* () {
        yield { type: 'text-delta', text: 'Yarım kalan cevap' }
        await gate
      })()
    } as never)

    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Uzun bir soru')

    await waitFor(() => events.some((e) => e.type === 'delta'))
    stopChat(conversation.id)
    release()

    await waitFor(() => events.some((e) => e.type === 'stopped'))
    expect(listMessages(conversation.id)[1]).toMatchObject({ content: 'Yarım kalan cevap' })
  })
})

describe('regenerateReply', () => {
  it('son asistan cevabını silip aynı soruyu yeniden cevaplar', async () => {
    mockStreamText.mockReturnValueOnce({
      stream: streamOf([{ type: 'text-delta', text: 'İlk cevap' }])
    } as never)
    const conversation = createConversation()
    const firstEvents: ChatEvent[] = []
    sendMessage(fakeSender(firstEvents), conversation.id, 'Soru')
    await waitFor(() => firstEvents.some((e) => e.type === 'done'))

    mockStreamText.mockReturnValueOnce({
      stream: streamOf([{ type: 'text-delta', text: 'İkinci cevap' }])
    } as never)
    const secondEvents: ChatEvent[] = []
    regenerateReply(fakeSender(secondEvents), conversation.id)
    await waitFor(() => secondEvents.some((e) => e.type === 'done'))

    const messages = listMessages(conversation.id)
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({ content: 'İkinci cevap' })
  })

  it('sohbette hiç mesaj yoksa hata verir', () => {
    const conversation = createConversation()
    expect(() => regenerateReply(fakeSender([]), conversation.id)).toThrow('henüz mesaj yok')
  })
})

describe('editAndResend', () => {
  it('mesajı ve sonrasını silip yenisiyle yeniden cevap yazdırır', async () => {
    mockStreamText.mockReturnValueOnce({
      stream: streamOf([{ type: 'text-delta', text: 'İlk cevap' }])
    } as never)
    const conversation = createConversation()
    const firstEvents: ChatEvent[] = []
    const userMessage = sendMessage(fakeSender(firstEvents), conversation.id, 'İlk soru')
    await waitFor(() => firstEvents.some((e) => e.type === 'done'))

    mockStreamText.mockReturnValueOnce({
      stream: streamOf([{ type: 'text-delta', text: 'Düzeltilmiş cevap' }])
    } as never)
    const secondEvents: ChatEvent[] = []
    editAndResend(fakeSender(secondEvents), conversation.id, userMessage.id, 'Düzeltilmiş soru')
    await waitFor(() => secondEvents.some((e) => e.type === 'done'))

    const messages = listMessages(conversation.id)
    expect(messages.map((m) => m.content)).toEqual(['Düzeltilmiş soru', 'Düzeltilmiş cevap'])
  })
})

describe('varsayılan ayarlar', () => {
  it('yaratıcılık/model uzunluğu ayarları streamText çağrısına doğru geçer', async () => {
    updateSettings({ contextLength: 8192, temperature: 0.7 })
    expect(getSettings().provider).toBe('ollama')

    mockStreamText.mockReturnValue({
      stream: streamOf([{ type: 'text-delta', text: 'Tamam.' }])
    } as never)
    const conversation = createConversation()
    const events: ChatEvent[] = []
    sendMessage(fakeSender(events), conversation.id, 'Selam')

    await waitFor(() => events.some((e) => e.type === 'done'))
    const call = mockStreamText.mock.calls[0][0] as {
      temperature?: number
      providerOptions?: { ollama?: { options?: { num_ctx?: number } } }
    }
    expect(call.temperature).toBe(0.7)
    expect(call.providerOptions?.ollama?.options?.num_ctx).toBe(8192)
  })
})
