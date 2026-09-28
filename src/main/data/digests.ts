import { getDb } from '../db'
import { blobToFloats } from '../lib/embeddingBlob'

// Konuşma hafızası: her sohbetin tarihli kısa özeti. Hafıza işleyici (ai/memoryProcessor.ts)
// yazar; sohbette konuyla ilgili geçmiş konuşmaları bulmak ve gecmiste_ara aracı için okunur.

export interface ConversationDigest {
  conversationId: number
  summary: string
  /** İşlenen son mesajın kimliği; bundan yeni mesaj varsa sohbet yeniden işlenir */
  processedUntil: number
  startedAt: string
  endedAt: string
}

export interface DigestWithEmbedding extends ConversationDigest {
  embedding: Float32Array | null
}

interface DigestRow {
  conversation_id: number
  summary: string
  processed_until: number
  started_at: string
  ended_at: string
  embedding?: Buffer | null
}

const toDigest = (row: DigestRow): ConversationDigest => ({
  conversationId: row.conversation_id,
  summary: row.summary,
  processedUntil: row.processed_until,
  startedAt: row.started_at,
  endedAt: row.ended_at
})

export function getDigest(conversationId: number): ConversationDigest | null {
  const row = getDb()
    .prepare('SELECT * FROM conversation_digests WHERE conversation_id = ?')
    .get(conversationId) as DigestRow | undefined
  return row ? toDigest(row) : null
}

/** Özeti yazar veya günceller; özet değiştiği için eski embedding silinir (yeniden hesaplanır) */
export function upsertDigest(digest: ConversationDigest): void {
  getDb()
    .prepare(
      `INSERT INTO conversation_digests (conversation_id, summary, processed_until, started_at, ended_at)
       VALUES (@conversationId, @summary, @processedUntil, @startedAt, @endedAt)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary = excluded.summary,
         processed_until = excluded.processed_until,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         embedding = NULL,
         updated_at = datetime('now')`
    )
    .run(digest)
}

/**
 * Sadece işlendi işaretini ilerletir (ör. yeni mesajlarda kaydedilecek bir şey çıkmadı ve özet yok).
 * Böylece aynı mesajlar tekrar tekrar işlenmez.
 */
export function markDigestProcessed(conversationId: number, processedUntil: number): void {
  getDb()
    .prepare('UPDATE conversation_digests SET processed_until = ? WHERE conversation_id = ?')
    .run(processedUntil, conversationId)
}

export function setDigestEmbedding(conversationId: number, embedding: Buffer): void {
  getDb()
    .prepare('UPDATE conversation_digests SET embedding = ? WHERE conversation_id = ?')
    .run(embedding, conversationId)
}

export function listDigestsWithEmbeddings(): DigestWithEmbedding[] {
  const rows = getDb()
    .prepare('SELECT * FROM conversation_digests ORDER BY ended_at DESC')
    .all() as DigestRow[]
  return rows.map((row) => ({
    ...toDigest(row),
    embedding: row.embedding ? blobToFloats(row.embedding) : null
  }))
}

export function listDigestsMissingEmbedding(): ConversationDigest[] {
  const rows = getDb()
    .prepare('SELECT * FROM conversation_digests WHERE embedding IS NULL')
    .all() as DigestRow[]
  return rows.map(toDigest)
}

export interface PendingConversation {
  conversationId: number
  /** İşlenmemiş en yeni mesajın kimliği */
  lastMessageId: number
  processedUntil: number
}

/**
 * İşlenmeyi bekleyen sohbetler: işlenmiş son mesajdan yeni mesajı olan ve son mesajı en az
 * `idleMinutes` dakika önce yazılmış (konuşma bitmiş sayılan) sohbetler, eskiden yeniye.
 * Eski sohbetlerin geriye dönük işlenmesi de buradan olur (hiç özeti yoksa processedUntil 0).
 */
export function listConversationsPendingDigest(idleMinutes: number): PendingConversation[] {
  return getDb()
    .prepare(
      `SELECT m.conversation_id AS conversationId,
              MAX(m.id) AS lastMessageId,
              COALESCE(d.processed_until, 0) AS processedUntil
       FROM messages m
       LEFT JOIN conversation_digests d ON d.conversation_id = m.conversation_id
       GROUP BY m.conversation_id
       HAVING MAX(m.id) > COALESCE(d.processed_until, 0)
          AND MAX(m.created_at) <= datetime('now', ?)
       ORDER BY MAX(m.id)`
    )
    .all(`-${Math.max(0, Math.floor(idleMinutes))} minutes`) as PendingConversation[]
}
