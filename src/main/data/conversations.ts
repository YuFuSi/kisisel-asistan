import { getDb } from '../db'
import type { ChatMessage, ChatRole, Conversation, ToolActivity } from '../../shared/api'

interface ConversationRow {
  id: number
  title: string
  updated_at: string
}

interface MessageRow {
  id: number
  conversation_id: number
  role: ChatRole
  content: string
  tools: string
  created_at: string
}

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  updatedAt: row.updated_at
})

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  tools: JSON.parse(row.tools) as ToolActivity[],
  createdAt: row.created_at
})

export function listConversations(): Conversation[] {
  const rows = getDb()
    .prepare('SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC, id DESC')
    .all() as ConversationRow[]
  return rows.map(toConversation)
}

export function createConversation(): Conversation {
  const db = getDb()
  const { lastInsertRowid } = db.prepare('INSERT INTO conversations DEFAULT VALUES').run()
  const row = db
    .prepare('SELECT id, title, updated_at FROM conversations WHERE id = ?')
    .get(lastInsertRowid) as ConversationRow
  return toConversation(row)
}

export function deleteConversation(id: number): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

// Başlığı olmayan sohbete ilk mesajdan kısa bir başlık ver
export function setTitleIfEmpty(id: number, text: string): void {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  const title = oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine
  getDb().prepare("UPDATE conversations SET title = ? WHERE id = ? AND title = ''").run(title, id)
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
  tools: ToolActivity[] = []
): ChatMessage {
  const db = getDb()
  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO messages (conversation_id, role, content, tools) VALUES (?, ?, ?, ?)')
      .run(conversationId, role, content, JSON.stringify(tools))
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(
      conversationId
    )
    return toMessage(
      db.prepare('SELECT * FROM messages WHERE id = ?').get(lastInsertRowid) as MessageRow
    )
  })()
}
