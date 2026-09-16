import {
  listNotesMissingEmbedding,
  listNotesWithEmbeddings,
  searchNotes,
  setNoteEmbedding
} from '../data/notes'
import { floatsToBlob } from '../lib/embeddingBlob'
import { sortBySimilarity } from '../lib/semanticSearch'
import { getSettings } from '../settings'
import type { Note } from '../../shared/api'
import type { NoteWithEmbedding } from '../data/notes'
import { embedText } from './embeddings'

// listNotesWithEmbeddings'ten gelen kayıtlar embedding (Float32Array) taşıyor; IPC üzerinden
// renderer'a giden hiçbir yol bu ham veriyi taşımamalı. Dönüş öncesi her zaman soyulur.
const stripEmbedding = (note: NoteWithEmbedding): Note => ({
  id: note.id,
  title: note.title,
  content: note.content,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt
})

/** Bir notun gömme vektörünü hesaplayıp veritabanına yazar. Ayar kapalıysa hiçbir şey yapmaz. */
export async function embedNote(id: number, title: string, content: string): Promise<void> {
  if (!getSettings().semanticSearchEnabled) return
  const vector = await embedText(`${title}\n${content}`)
  setNoteEmbedding(id, floatsToBlob(vector))
}

/**
 * createNote/updateNote sonrası çağrılır. Embedding hesaplaması sohbeti veya arayüzü
 * bekletmesin diye arka planda (fire-and-forget) yapılır; hata olursa sadece günlüğe yazılır.
 */
export function scheduleNoteEmbedding(id: number, title: string, content: string): void {
  void embedNote(id, title, content).catch((err: unknown) => {
    console.error(`Not ${id} için embedding hesaplanamadı:`, err)
  })
}

/**
 * Embedding'i eksik tüm notları sırayla doldurur (Ollama'yı yormamak için art arda, paralel
 * değil). İşlenen kayıt sayısını döndürür.
 */
export async function backfillNoteEmbeddings(): Promise<number> {
  const missing = listNotesMissingEmbedding()
  for (const note of missing) {
    await embedNote(note.id, note.title, note.content)
  }
  return missing.length
}

/**
 * Notlarda arama. Anlamsal arama kapalıysa, hiç not yoksa, notların bir kısmı henüz
 * indekslenmemişse veya sorgu embedding'i hesaplanamazsa (Ollama kapalı vb.) mevcut anahtar
 * kelime aramasına (searchNotes) düşülür — arama asla bu yüzden hata vermez.
 */
export async function searchNotesSemantic(query: string, limit = 10): Promise<Note[]> {
  if (!getSettings().semanticSearchEnabled) return searchNotes(query, limit)

  const notes = listNotesWithEmbeddings()
  if (notes.length === 0) return []
  if (notes.some((note) => note.embedding === null)) return searchNotes(query, limit)

  try {
    const queryEmbedding = await embedText(query)
    return sortBySimilarity(notes, queryEmbedding).slice(0, limit).map(stripEmbedding)
  } catch (err) {
    console.error('Anlamsal not araması başarısız, anahtar kelimeye düşülüyor:', err)
    return searchNotes(query, limit)
  }
}
