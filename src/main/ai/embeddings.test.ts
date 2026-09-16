import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { blobToFloats, embedText, floatsToBlob } from './embeddings'

beforeEach(() => {
  initDatabase(':memory:')
})

afterEach(() => {
  closeDb()
  vi.unstubAllGlobals()
})

describe('embedText', () => {
  it('doğru istek gövdesiyle Ollama /api/embed uç noktasını çağırır ve vektörü döndürür', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await embedText('merhaba')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/embed')
    expect(JSON.parse(options.body)).toEqual({ model: 'bge-m3', input: 'merhaba' })
    expect(Array.from(result)).toEqual([Math.fround(0.1), Math.fround(0.2), Math.fround(0.3)])
  })

  it('Ollama’ya bağlanılamazsa Türkçe hata fırlatır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(embedText('merhaba')).rejects.toThrow("Ollama'ya bağlanılamadı")
  })

  it('model bulunamazsa (404) indirme talimatı içeren Türkçe hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    )
    await expect(embedText('merhaba')).rejects.toThrow('ollama pull bge-m3')
  })

  it('sunucu başka bir hata döndürürse genel Türkçe hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    )
    await expect(embedText('merhaba')).rejects.toThrow('HTTP 500')
  })

  it('boş sonuç gelirse hata fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ embeddings: [] }) })
    )
    await expect(embedText('merhaba')).rejects.toThrow('boş sonuç')
  })
})

describe('floatsToBlob / blobToFloats', () => {
  it('bir vektörü baytlara çevirip geri okuyunca aynı değerleri verir', () => {
    const original = new Float32Array([1.5, -2.25, 0, 3.75])
    const blob = floatsToBlob(original)
    const restored = blobToFloats(blob)
    expect(Array.from(restored)).toEqual(Array.from(original))
  })
})
