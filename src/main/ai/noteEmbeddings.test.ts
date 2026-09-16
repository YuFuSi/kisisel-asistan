import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { createNote, listNotesMissingEmbedding, setNoteEmbedding } from '../data/notes'
import { floatsToBlob } from '../lib/embeddingBlob'
import { updateSettings } from '../settings'
import { embedText } from './embeddings'
import {
  backfillNoteEmbeddings,
  embedNote,
  scheduleNoteEmbedding,
  searchNotesSemantic
} from './noteEmbeddings'

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

describe('embedNote', () => {
  it('anlamsal arama kapalıysa hiçbir şey yapmaz', async () => {
    updateSettings({ semanticSearchEnabled: false })
    const note = createNote({ title: 'Fikirler', content: 'Uygulama' })
    await embedNote(note.id, note.title, note.content)
    expect(mockEmbedText).not.toHaveBeenCalled()
    expect(listNotesMissingEmbedding().map((n) => n.id)).toContain(note.id)
  })

  it('anlamsal arama açıksa embedding hesaplayıp yazar', async () => {
    updateSettings({ semanticSearchEnabled: true })
    const note = createNote({ title: 'Fikirler', content: 'Uygulama' })
    await embedNote(note.id, note.title, note.content)
    expect(mockEmbedText).toHaveBeenCalledWith('Fikirler\nUygulama')
    expect(listNotesMissingEmbedding().map((n) => n.id)).not.toContain(note.id)
  })
})

describe('scheduleNoteEmbedding', () => {
  it('embedText hata verirse çökmez, sessizce günlüğe yazar', async () => {
    updateSettings({ semanticSearchEnabled: true })
    mockEmbedText.mockRejectedValue(new Error('bağlantı hatası'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const note = createNote({ title: 'Fikirler', content: 'Uygulama' })

    scheduleNoteEmbedding(note.id, note.title, note.content)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('backfillNoteEmbeddings', () => {
  it("eksik embedding'i olan tüm notları doldurur ve sayısını döndürür", async () => {
    updateSettings({ semanticSearchEnabled: true })
    createNote({ title: 'Fikirler', content: 'Uygulama' })
    createNote({ title: 'Alışveriş', content: 'ekmek, süt' })

    const count = await backfillNoteEmbeddings()

    expect(count).toBe(2)
    expect(listNotesMissingEmbedding()).toHaveLength(0)
  })

  it('eksik kayıt yoksa 0 döndürür', async () => {
    updateSettings({ semanticSearchEnabled: true })
    expect(await backfillNoteEmbeddings()).toBe(0)
  })
})

describe('searchNotesSemantic', () => {
  it('anlamsal arama kapalıysa anahtar kelime aramasına döner', async () => {
    updateSettings({ semanticSearchEnabled: false })
    createNote({ title: 'İstanbul gezisi', content: 'Şişli ve Kadıköy' })

    const result = await searchNotesSemantic('istanbul')

    expect(mockEmbedText).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })

  it('hiç not yoksa boş liste döner', async () => {
    updateSettings({ semanticSearchEnabled: true })
    expect(await searchNotesSemantic('herhangi bir şey')).toEqual([])
  })

  it("bazı notların embedding'i eksikse anahtar kelimeye düşer", async () => {
    updateSettings({ semanticSearchEnabled: true })
    const a = createNote({ title: 'İstanbul gezisi', content: 'Şişli ve Kadıköy' })
    createNote({ title: 'Alışveriş', content: 'ekmek, süt' })
    setNoteEmbedding(a.id, floatsToBlob(new Float32Array([1, 0, 0])))

    const result = await searchNotesSemantic('istanbul')

    expect(mockEmbedText).not.toHaveBeenCalled()
    expect(result.map((n) => n.id)).toEqual([a.id])
  })

  it("tüm notların embedding'i varsa anlamsal sıralama kullanır", async () => {
    updateSettings({ semanticSearchEnabled: true })
    const a = createNote({ title: 'Araba lastiği değişimi', content: 'Lastik masrafı 4000 TL' })
    const b = createNote({ title: 'Tatil planı', content: 'Antalya, Temmuz' })
    setNoteEmbedding(a.id, floatsToBlob(new Float32Array([1, 0, 0])))
    setNoteEmbedding(b.id, floatsToBlob(new Float32Array([0, 1, 0])))
    mockEmbedText.mockResolvedValue(new Float32Array([1, 0, 0]))

    const result = await searchNotesSemantic('lastik masrafı ne kadardı')

    expect(mockEmbedText).toHaveBeenCalledWith('lastik masrafı ne kadardı')
    expect(result[0].id).toBe(a.id)
  })

  it("sonuçlarda embedding alanı taşımaz (IPC ile renderer'a sızmasın)", async () => {
    updateSettings({ semanticSearchEnabled: true })
    const a = createNote({ title: 'Araba lastiği değişimi', content: 'Lastik masrafı 4000 TL' })
    setNoteEmbedding(a.id, floatsToBlob(new Float32Array([1, 0, 0])))
    mockEmbedText.mockResolvedValue(new Float32Array([1, 0, 0]))

    const result = await searchNotesSemantic('sorgu')

    expect(result[0]).not.toHaveProperty('embedding')
  })

  it("sorgu embedding'i hesaplanamazsa hata fırlatmaz, anahtar kelimeye düşer", async () => {
    updateSettings({ semanticSearchEnabled: true })
    const a = createNote({ title: 'İstanbul gezisi', content: 'Şişli ve Kadıköy' })
    setNoteEmbedding(a.id, floatsToBlob(new Float32Array([1, 0, 0])))
    mockEmbedText.mockRejectedValue(new Error('bağlantı hatası'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await searchNotesSemantic('istanbul')

    expect(result.map((n) => n.id)).toEqual([a.id])
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
