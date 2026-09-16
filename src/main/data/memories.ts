import { getDb } from '../db'
import { findSimilarMemory } from '../lib/memoryRank'
import type { Memory } from '../../shared/api'

interface MemoryRow {
  id: number
  content: string
  created_at: string
}

// Hafıza her sohbette talimata eklendiği için kayıtlar kısa tutulur
const MEMORY_LENGTH_LIMIT = 300

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  content: row.content,
  createdAt: row.created_at
})

function cleanContent(content: string): string {
  const value = content.replace(/\s+/g, ' ').trim()
  if (!value) throw new Error('Kaydedilecek bilgi boş olamaz.')
  if (value.length > MEMORY_LENGTH_LIMIT) {
    throw new Error(`Hafıza kaydı en fazla ${MEMORY_LENGTH_LIMIT} karakter olabilir.`)
  }
  return value
}

export function listMemories(): Memory[] {
  const rows = getDb().prepare('SELECT * FROM memories ORDER BY id').all() as MemoryRow[]
  return rows.map(toMemory)
}

/**
 * Yeni bilgi kaydeder. Aynı veya çok benzer bir kayıt varsa yeni kayıt açılmaz;
 * mevcut kayıt yeni yazımla güncellenir (ör. "Kahvesini şekersiz içer" → "Kahveyi şekersiz içiyor").
 */
export function createMemory(content: string): Memory {
  const value = cleanContent(content)
  const similar = findSimilarMemory(listMemories(), value)
  if (similar) return updateMemory(similar.id, value)

  const db = getDb()
  const { lastInsertRowid } = db.prepare('INSERT INTO memories (content) VALUES (?)').run(value)
  return toMemory(
    db.prepare('SELECT * FROM memories WHERE id = ?').get(lastInsertRowid) as MemoryRow
  )
}

export function updateMemory(id: number, content: string): Memory {
  const value = cleanContent(content)
  const db = getDb()
  const { changes } = db.prepare('UPDATE memories SET content = ? WHERE id = ?').run(value, id)
  if (changes === 0) throw new Error('Hafıza kaydı bulunamadı.')
  return toMemory(db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow)
}

export function deleteMemory(id: number): void {
  getDb().prepare('DELETE FROM memories WHERE id = ?').run(id)
}

/** Embedding'i henüz hesaplanmamış (NULL) kayıtlar — geriye dönük doldurma için */
export function listMemoriesMissingEmbedding(): Memory[] {
  const rows = getDb()
    .prepare('SELECT * FROM memories WHERE embedding IS NULL ORDER BY id')
    .all() as MemoryRow[]
  return rows.map(toMemory)
}

/** Bir kaydın gömme (embedding) vektörünü yazar */
export function setMemoryEmbedding(id: number, embedding: Buffer): void {
  getDb()
    .prepare(
      "UPDATE memories SET embedding = ?, embedding_updated_at = datetime('now') WHERE id = ?"
    )
    .run(embedding, id)
}
