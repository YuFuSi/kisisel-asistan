import { getDb } from '../db'
import { blobToFloats } from '../lib/embeddingBlob'
import { findSimilarMemory } from '../lib/memoryRank'
import { MEMORY_KINDS, type Memory, type MemoryKind, type MemorySource } from '../../shared/api'

interface MemoryRow {
  id: number
  content: string
  created_at: string
  kind: string
  source: string
  source_conversation_id: number | null
  reviewed: number
}

export interface MemoryOptions {
  kind?: MemoryKind
  source?: MemorySource
  sourceConversationId?: number | null
}

/** Modelden gelen serbest tür adını geçerli bir türe çevirir; bilinmeyen tür 'bilgi' sayılır */
export function normalizeMemoryKind(kind: string | undefined | null): MemoryKind {
  const value = (kind ?? '').toLocaleLowerCase('tr-TR').replace('ş', 's').replace('ı', 'i')
  return (MEMORY_KINDS as readonly string[]).includes(value) ? (value as MemoryKind) : 'bilgi'
}

interface MemoryRowWithEmbedding extends MemoryRow {
  embedding: Buffer | null
}

export interface MemoryWithEmbedding extends Memory {
  embedding: Float32Array | null
}

// Hafıza her sohbette talimata eklendiği için kayıtlar kısa tutulur
const MEMORY_LENGTH_LIMIT = 300

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  content: row.content,
  createdAt: row.created_at,
  kind: normalizeMemoryKind(row.kind),
  source: row.source === 'otomatik' || row.source === 'kullanici' ? row.source : 'arac',
  sourceConversationId: row.source_conversation_id,
  reviewed: row.reviewed !== 0
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
export function createMemory(content: string, options: MemoryOptions = {}): Memory {
  const value = cleanContent(content)
  const similar = findSimilarMemory(listMemories(), value)
  if (similar) return updateMemory(similar.id, value)
  return insertMemory(value, options)
}

/**
 * Benzerlik kontrolü yapmadan yeni kayıt ekler (tekilleştirmeyi çağıran yapmıştır, ör. hafıza
 * işleyici anlam benzerliğiyle). Otomatik öğrenilen kayıt gözden geçirilmemiş (reviewed = 0) başlar.
 */
export function insertMemory(content: string, options: MemoryOptions = {}): Memory {
  const value = cleanContent(content)
  const source = options.source ?? 'arac'
  const db = getDb()
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO memories (content, kind, source, source_conversation_id, reviewed) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      value,
      options.kind ?? 'bilgi',
      source,
      options.sourceConversationId ?? null,
      source === 'otomatik' ? 0 : 1
    )
  return toMemory(
    db.prepare('SELECT * FROM memories WHERE id = ?').get(lastInsertRowid) as MemoryRow
  )
}

export function updateMemory(id: number, content: string): Memory {
  const value = cleanContent(content)
  const db = getDb()
  const { changes } = db
    .prepare("UPDATE memories SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(value, id)
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

/** Tüm kayıtları gömme vektörleriyle birlikte döndürür (anlamsal sıralama için) */
export function listMemoriesWithEmbeddings(): MemoryWithEmbedding[] {
  const rows = getDb()
    .prepare('SELECT * FROM memories ORDER BY id')
    .all() as MemoryRowWithEmbedding[]
  return rows.map((row) => ({
    ...toMemory(row),
    embedding: row.embedding ? blobToFloats(row.embedding) : null
  }))
}

/** Kaydın türünü değiştirir (ör. kullanıcı Hafıza Merkezi'nde "Profil" yaptı) */
export function setMemoryKind(id: number, kind: MemoryKind): void {
  getDb().prepare('UPDATE memories SET kind = ? WHERE id = ?').run(kind, id)
}

/** Sohbette talimata eklenen kayıtların son kullanım zamanını işaretler */
export function markMemoriesUsed(ids: number[]): void {
  if (ids.length === 0) return
  const stmt = getDb().prepare("UPDATE memories SET last_used_at = datetime('now') WHERE id = ?")
  getDb().transaction(() => {
    for (const id of ids) stmt.run(id)
  })()
}

/** Otomatik öğrenilip henüz gözden geçirilmemiş kayıtlar ("yeni öğrenilenler") */
export function listUnreviewedMemories(): Memory[] {
  const rows = getDb()
    .prepare('SELECT * FROM memories WHERE reviewed = 0 ORDER BY id DESC')
    .all() as MemoryRow[]
  return rows.map(toMemory)
}

/** Kayıtları gözden geçirildi sayar; ids verilmezse hepsini */
export function markMemoriesReviewed(ids?: number[]): void {
  const db = getDb()
  if (!ids) {
    db.prepare('UPDATE memories SET reviewed = 1 WHERE reviewed = 0').run()
    return
  }
  const stmt = db.prepare('UPDATE memories SET reviewed = 1 WHERE id = ?')
  db.transaction(() => {
    for (const id of ids) stmt.run(id)
  })()
}
