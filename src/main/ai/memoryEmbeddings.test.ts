import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { createMemory, listMemoriesMissingEmbedding } from '../data/memories'
import { updateSettings } from '../settings'
import { embedText } from './embeddings'
import { backfillMemoryEmbeddings, embedMemory, scheduleMemoryEmbedding } from './memoryEmbeddings'

vi.mock('./embeddings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./embeddings')>()
  return { ...actual, embedText: vi.fn() }
})

const mockEmbedText = vi.mocked(embedText)

beforeEach(() => {
  initDatabase(':memory:')
  mockEmbedText.mockReset()
  mockEmbedText.mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]))
})

afterEach(() => closeDb())

describe('embedMemory', () => {
  it('anlamsal arama kapalıysa hiçbir şey yapmaz', async () => {
    updateSettings({ semanticSearchEnabled: false })
    const memory = createMemory('Kahvesini şekersiz içer')
    await embedMemory(memory.id, memory.content)
    expect(mockEmbedText).not.toHaveBeenCalled()
    expect(listMemoriesMissingEmbedding().map((m) => m.id)).toContain(memory.id)
  })

  it('anlamsal arama açıksa embedding hesaplayıp yazar', async () => {
    updateSettings({ semanticSearchEnabled: true })
    const memory = createMemory('Kahvesini şekersiz içer')
    await embedMemory(memory.id, memory.content)
    expect(mockEmbedText).toHaveBeenCalledWith('Kahvesini şekersiz içer')
    expect(listMemoriesMissingEmbedding().map((m) => m.id)).not.toContain(memory.id)
  })
})

describe('scheduleMemoryEmbedding', () => {
  it('embedText hata verirse çökmez, sessizce günlüğe yazar', async () => {
    updateSettings({ semanticSearchEnabled: true })
    mockEmbedText.mockRejectedValue(new Error('bağlantı hatası'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const memory = createMemory('Kahvesini şekersiz içer')

    scheduleMemoryEmbedding(memory.id, memory.content)
    // fire-and-forget: mikro görev kuyruğunun boşalmasını bekle
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('backfillMemoryEmbeddings', () => {
  it("eksik embedding'i olan tüm kayıtları doldurur ve sayısını döndürür", async () => {
    updateSettings({ semanticSearchEnabled: true })
    createMemory('Kahvesini şekersiz içer')
    createMemory('Sabahları koşuya çıkar')

    const count = await backfillMemoryEmbeddings()

    expect(count).toBe(2)
    expect(listMemoriesMissingEmbedding()).toHaveLength(0)
  })

  it('eksik kayıt yoksa 0 döndürür', async () => {
    updateSettings({ semanticSearchEnabled: true })
    expect(await backfillMemoryEmbeddings()).toBe(0)
  })
})
