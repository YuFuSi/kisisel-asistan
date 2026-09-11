import { getDb } from '../db'
import type { Memory } from '../../shared/api'

interface MemoryRow {
  id: number
  content: string
  created_at: string
}

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  content: row.content,
  createdAt: row.created_at
})

export function listMemories(): Memory[] {
  const rows = getDb().prepare('SELECT * FROM memories ORDER BY id').all() as MemoryRow[]
  return rows.map(toMemory)
}

// Aynı bilgi (büyük/küçük harf farkı gözetmeden) zaten kayıtlıysa tekrar eklemez
export function createMemory(content: string): Memory {
  const value = content.trim()
  if (!value) throw new Error('Kaydedilecek bilgi boş olamaz.')

  const key = value.toLocaleLowerCase('tr-TR')
  const existing = listMemories().find((m) => m.content.toLocaleLowerCase('tr-TR') === key)
  if (existing) return existing

  const db = getDb()
  const { lastInsertRowid } = db.prepare('INSERT INTO memories (content) VALUES (?)').run(value)
  return toMemory(
    db.prepare('SELECT * FROM memories WHERE id = ?').get(lastInsertRowid) as MemoryRow
  )
}

export function deleteMemory(id: number): void {
  getDb().prepare('DELETE FROM memories WHERE id = ?').run(id)
}
