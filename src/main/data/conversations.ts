import { getDb } from '../db'
import type {
  ChatMessage,
  ChatRole,
  Conversation,
  ConversationSearchResult,
  OutcomeKind,
  ToolActivity
} from '../../shared/api'

interface ConversationRow {
  id: number
  title: string
  updated_at: string
  pinned: number
}

interface MessageRow {
  id: number
  conversation_id: number
  role: ChatRole
  content: string
  tools: string
  created_at: string
  outcome: string | null
}

const CONVERSATION_FIELDS = 'id, title, updated_at, pinned'

// Sabitlenenler üstte, sonra en son konuşulan
const CONVERSATION_ORDER = 'ORDER BY pinned DESC, updated_at DESC, id DESC'

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  updatedAt: row.updated_at,
  pinned: row.pinned === 1
})

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  tools: JSON.parse(row.tools) as ToolActivity[],
  createdAt: row.created_at,
  outcome: OUTCOMES.includes(row.outcome as OutcomeKind) ? (row.outcome as OutcomeKind) : null
})

const OUTCOMES: OutcomeKind[] = ['completed', 'partial', 'rejected', 'timeout', 'stopped', 'error']

// Aramada Türkçe I/İ/ı/i ayrımı kullanıcıyı yanıltıyor ("Ikinci" yazan başlık "ikinci" ile bulunmalı),
// bu yüzden hepsi "i" sayılır. Karakter sayısı değişmez, böylece alıntı konumları kaymaz.
const lower = (text: string): string => text.replace(/[İIı]/g, 'i').toLowerCase()

export function listConversations(): Conversation[] {
  const rows = getDb()
    .prepare(`SELECT ${CONVERSATION_FIELDS} FROM conversations ${CONVERSATION_ORDER}`)
    .all() as ConversationRow[]
  return rows.map(toConversation)
}

export function getConversation(id: number): Conversation | undefined {
  const row = getDb()
    .prepare(`SELECT ${CONVERSATION_FIELDS} FROM conversations WHERE id = ?`)
    .get(id) as ConversationRow | undefined
  return row ? toConversation(row) : undefined
}

function requireConversation(id: number): Conversation {
  const conversation = getConversation(id)
  if (!conversation) throw new Error(`${id} numaralı sohbet bulunamadı.`)
  return conversation
}

export function createConversation(): Conversation {
  const { lastInsertRowid } = getDb().prepare('INSERT INTO conversations DEFAULT VALUES').run()
  return requireConversation(Number(lastInsertRowid))
}

export function deleteConversation(id: number): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function renameConversation(id: number, title: string): Conversation {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!clean) throw new Error('Sohbet başlığı boş olamaz.')
  // Kullanıcı ad verdi: bundan sonra model başlığı değiştirmesin
  getDb().prepare('UPDATE conversations SET title = ?, title_auto = 0 WHERE id = ?').run(clean, id)
  return requireConversation(id)
}

/** Modelin ürettiği başlık; kullanıcı sohbeti kendi adlandırdıysa yok sayılır */
export function setGeneratedTitle(id: number, title: string): void {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!clean) return
  getDb()
    .prepare('UPDATE conversations SET title = ? WHERE id = ? AND title_auto = 1')
    .run(clean, id)
}

/** Sohbet baştan yazılırken otomatik başlığı sıfırlar (kullanıcının verdiği ada dokunmaz) */
export function clearGeneratedTitle(id: number): void {
  getDb().prepare("UPDATE conversations SET title = '' WHERE id = ? AND title_auto = 1").run(id)
}

export function setConversationPinned(id: number, pinned: boolean): Conversation {
  getDb()
    .prepare('UPDATE conversations SET pinned = ? WHERE id = ?')
    .run(pinned ? 1 : 0, id)
  return requireConversation(id)
}

/** İlk mesajdan üretilen geçici başlık (model daha iyisini üretene kadar kullanılır) */
export function deriveTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine
}

// Başlığı olmayan sohbete ilk mesajdan kısa bir başlık ver
export function setTitleIfEmpty(id: number, text: string): void {
  getDb()
    .prepare("UPDATE conversations SET title = ? WHERE id = ? AND title = ''")
    .run(deriveTitle(text), id)
}

export function listMessages(conversationId: number): ChatMessage[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id')
    .all(conversationId) as MessageRow[]
  return rows.map(toMessage)
}

export function addMessage(
  conversationId: number,
  role: ChatRole,
  content: string,
  tools: ToolActivity[] = [],
  outcome: OutcomeKind | null = null
): ChatMessage {
  const db = getDb()
  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO messages (conversation_id, role, content, tools, outcome) VALUES (?, ?, ?, ?, ?)'
      )
      .run(conversationId, role, content, JSON.stringify(tools), outcome)
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(
      conversationId
    )
    return toMessage(
      db.prepare('SELECT * FROM messages WHERE id = ?').get(lastInsertRowid) as MessageRow
    )
  })()
}

export function deleteMessage(id: number): void {
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(id)
}

/** Verilen mesaj ve sonrasındaki tüm mesajları siler (mesaj düzenlenip yeniden gönderilirken) */
export function deleteMessagesFrom(conversationId: number, messageId: number): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE conversation_id = ? AND id >= ?').run(
      conversationId,
      messageId
    )
    // Silinen mesajlar özetin kapsadığı kısımdaysa özet artık doğru değildir
    db.prepare(
      "UPDATE conversations SET summary = '', summary_until = 0 WHERE id = ? AND summary_until >= ?"
    ).run(conversationId, messageId)
  })()
}

export interface ConversationSummary {
  /** Sohbetin modele artık tam gönderilmeyen eski kısmının özeti */
  summary: string
  /** Özetin kapsadığı en son mesajın kimliği */
  until: number
}

export function getConversationSummary(id: number): ConversationSummary {
  const row = getDb()
    .prepare('SELECT summary, summary_until FROM conversations WHERE id = ?')
    .get(id) as { summary: string; summary_until: number } | undefined
  return { summary: row?.summary ?? '', until: row?.summary_until ?? 0 }
}

export function setConversationSummary(id: number, summary: string, until: number): void {
  getDb()
    .prepare('UPDATE conversations SET summary = ?, summary_until = ? WHERE id = ?')
    .run(summary, until, id)
}

// Aranan kelimeler için taranacak en fazla mesaj sayısı
const SEARCH_MESSAGE_LIMIT = 5000
const SNIPPET_LENGTH = 120

/**
 * Sohbet başlıklarında ve mesaj içeriklerinde arar.
 * Türkçe büyük/küçük harf farkını doğru ele almak için filtreleme JavaScript'te yapılır.
 */
export function searchConversations(query: string): ConversationSearchResult[] {
  const needle = lower(query.trim())
  const conversations = listConversations()
  if (!needle) return conversations.map((conversation) => ({ conversation, snippet: null }))

  const rows = getDb()
    .prepare(
      `SELECT conversation_id, content FROM messages ORDER BY id DESC LIMIT ${SEARCH_MESSAGE_LIMIT}`
    )
    .all() as { conversation_id: number; content: string }[]

  const snippets = new Map<number, string>()
  for (const row of rows) {
    if (snippets.has(row.conversation_id)) continue
    const index = lower(row.content).indexOf(needle)
    if (index === -1) continue
    const start = Math.max(0, index - 30)
    const text = row.content
      .slice(start, start + SNIPPET_LENGTH)
      .replace(/\s+/g, ' ')
      .trim()
    snippets.set(row.conversation_id, start > 0 ? `…${text}` : text)
  }

  return conversations
    .filter(
      (conversation) => lower(conversation.title).includes(needle) || snippets.has(conversation.id)
    )
    .map((conversation) => ({
      conversation,
      snippet: snippets.get(conversation.id) ?? null
    }))
}
