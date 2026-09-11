import { getDb } from '../db'
import type { Note, NotePatch } from '../../shared/api'

interface NoteRow {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

const toNote = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export function listNotes(): Note[] {
  const rows = getDb()
    .prepare('SELECT * FROM notes ORDER BY updated_at DESC, id DESC')
    .all() as NoteRow[]
  return rows.map(toNote)
}

function requireNote(id: number): Note {
  const row = getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
  if (!row) throw new Error(`${id} numaralı not bulunamadı.`)
  return toNote(row)
}

export function createNote(input: NotePatch): Note {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO notes (title, content) VALUES (?, ?)')
    .run(input.title?.trim() ?? '', input.content ?? '')
  return requireNote(Number(lastInsertRowid))
}

// Not: Başlık burada kırpılmaz; arayüz yazarken otomatik kaydettiği için
// kırpmak, yazılan değer ile kaydedilen değerin sürekli farklı görünmesine yol açar.
export function updateNote(id: number, patch: NotePatch): Note {
  const current = requireNote(id)
  getDb()
    .prepare("UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(patch.title ?? current.title, patch.content ?? current.content, id)
  return requireNote(id)
}

export function deleteNote(id: number): void {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

// Tüm kelimeleri içeren notları bulur. Türkçe büyük/küçük harf (İ/i, I/ı) doğru karşılaştırılır;
// SQLite'ın LIKE'ı bunu yapamadığı için filtreleme JavaScript'te yapılır.
export function searchNotes(query: string, limit = 10): Note[] {
  const words = query.toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean)
  const notes = listNotes()
  const matches = words.length
    ? notes.filter((note) => {
        const text = `${note.title}\n${note.content}`.toLocaleLowerCase('tr-TR')
        return words.every((word) => text.includes(word))
      })
    : notes
  return matches.slice(0, limit)
}
