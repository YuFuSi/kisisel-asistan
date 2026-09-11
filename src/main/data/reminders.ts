import { getDb } from '../db'
import type { Reminder } from '../../shared/api'

interface ReminderRow {
  id: number
  message: string
  remind_at: number
  sent_at: number | null
}

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  message: row.message,
  remindAt: row.remind_at,
  sentAt: row.sent_at
})

export function listPendingReminders(): Reminder[] {
  const rows = getDb()
    .prepare('SELECT * FROM reminders WHERE sent_at IS NULL ORDER BY remind_at, id')
    .all() as ReminderRow[]
  return rows.map(toReminder)
}

export function createReminder(message: string, remindAt: number): Reminder {
  const text = message.trim()
  if (!text) throw new Error('Hatırlatma metni boş olamaz.')
  if (!Number.isFinite(remindAt)) throw new Error('Hatırlatma zamanı geçersiz.')

  const db = getDb()
  const { lastInsertRowid } = db
    .prepare('INSERT INTO reminders (message, remind_at) VALUES (?, ?)')
    .run(text, Math.round(remindAt))
  return toReminder(
    db.prepare('SELECT * FROM reminders WHERE id = ?').get(lastInsertRowid) as ReminderRow
  )
}

export function deleteReminder(id: number): void {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id)
}

// Zamanı gelmiş ve henüz gösterilmemiş hatırlatmaları "gösterildi" olarak işaretleyip döndürür.
// Aynı hatırlatma iki kez dönmez.
export function takeDueReminders(now: number): Reminder[] {
  const db = getDb()
  return db.transaction(() => {
    const rows = db
      .prepare(
        'SELECT * FROM reminders WHERE sent_at IS NULL AND remind_at <= ? ORDER BY remind_at'
      )
      .all(now) as ReminderRow[]
    const markSent = db.prepare('UPDATE reminders SET sent_at = ? WHERE id = ?')
    for (const row of rows) markSent.run(now, row.id)
    return rows.map((row) => toReminder({ ...row, sent_at: now }))
  })()
}
