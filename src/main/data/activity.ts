import { getDb } from '../db'
import type { ActivityApproval, ActivityEntry, ActivityStatus, ToolSource } from '../../shared/api'

interface ActivityRow {
  id: number
  created_at: number
  source: ToolSource
  kind: 'tool'
  name: string
  label: string
  summary: string
  detail: string
  status: ActivityStatus
  approval: ActivityApproval
  conversation_id: number | null
}

export interface ActivityInput {
  source: ToolSource
  name: string
  label: string
  summary?: string
  detail?: string
  status: ActivityStatus
  approval?: ActivityApproval
  conversationId?: number | null
}

const SUMMARY_LIMIT = 200
const DETAIL_LIMIT = 1000
const MAX_LIST = 200

const clip = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text

const toEntry = (row: ActivityRow): ActivityEntry => ({
  id: row.id,
  createdAt: row.created_at,
  source: row.source,
  kind: row.kind,
  name: row.name,
  label: row.label,
  summary: row.summary,
  detail: row.detail,
  status: row.status,
  approval: row.approval,
  conversationId: row.conversation_id
})

export function logActivity(input: ActivityInput, now = Date.now()): ActivityEntry {
  const db = getDb()
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO activity_log
        (created_at, source, kind, name, label, summary, detail, status, approval, conversation_id)
       VALUES (?, ?, 'tool', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      now,
      input.source,
      input.name,
      input.label,
      clip((input.summary ?? '').trim(), SUMMARY_LIMIT),
      clip((input.detail ?? '').trim(), DETAIL_LIMIT),
      input.status,
      input.approval ?? null,
      input.conversationId ?? null
    )
  return toEntry(
    db.prepare('SELECT * FROM activity_log WHERE id = ?').get(lastInsertRowid) as ActivityRow
  )
}

/** Son işlemler, en yenisi başta */
export function listActivity(limit = 20): ActivityEntry[] {
  const count = Math.min(Math.max(Math.floor(limit), 1), MAX_LIST)
  const rows = getDb()
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(count) as ActivityRow[]
  return rows.map(toEntry)
}

/** Analizler ve Başarımlar sayfaları için: belirtilen zamandan yeni tüm kayıtlar */
export function listActivitySince(since: number): ActivityEntry[] {
  const rows = getDb()
    .prepare('SELECT * FROM activity_log WHERE created_at >= ? ORDER BY created_at ASC')
    .all(since) as ActivityRow[]
  return rows.map(toEntry)
}

/** Verilen zamandan eski kayıtları siler, silinen kayıt sayısını döndürür */
export function pruneActivity(olderThan: number): number {
  return getDb().prepare('DELETE FROM activity_log WHERE created_at < ?').run(olderThan).changes
}
