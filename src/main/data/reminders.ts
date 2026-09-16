import { getDb } from '../db'
import { nextReminderTime } from '../lib/repeat'
import type { Reminder, RepeatRule } from '../../shared/api'

interface ReminderRow {
  id: number
  message: string
  remind_at: number
  sent_at: number | null
  repeat: string
}

const REPEAT_RULES: RepeatRule[] = ['none', 'daily', 'weekdays', 'weekly']

const toRepeat = (value: string): RepeatRule =>
  (REPEAT_RULES as string[]).includes(value) ? (value as RepeatRule) : 'none'

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  message: row.message,
  remindAt: row.remind_at,
  sentAt: row.sent_at,
  repeat: toRepeat(row.repeat)
})

const getRow = (id: number): ReminderRow =>
  getDb().prepare('SELECT * FROM reminders WHERE id = ?').get(id) as ReminderRow

export function listPendingReminders(): Reminder[] {
  const rows = getDb()
    .prepare('SELECT * FROM reminders WHERE sent_at IS NULL ORDER BY remind_at, id')
    .all() as ReminderRow[]
  return rows.map(toReminder)
}

/** Bekleyen ve çalmış tüm hatırlatmalar (proaktif gözlem gibi çalmışları da görmesi gereken işler için) */
export function listReminders(): Reminder[] {
  const rows = getDb()
    .prepare('SELECT * FROM reminders ORDER BY remind_at, id')
    .all() as ReminderRow[]
  return rows.map(toReminder)
}

export function createReminder(
  message: string,
  remindAt: number,
  repeat: RepeatRule = 'none'
): Reminder {
  const text = message.trim()
  if (!text) throw new Error('Hatırlatma metni boş olamaz.')
  if (!Number.isFinite(remindAt)) throw new Error('Hatırlatma zamanı geçersiz.')
  if (!REPEAT_RULES.includes(repeat)) throw new Error('Geçersiz tekrar kuralı.')

  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO reminders (message, remind_at, repeat) VALUES (?, ?, ?)')
    .run(text, Math.round(remindAt), repeat)
  return toReminder(getRow(Number(lastInsertRowid)))
}

export function deleteReminder(id: number): void {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id)
}

/** Hatırlatmayı ileri atar. Gösterilmiş olsa bile tekrar bekler duruma gelir. */
export function snoozeReminder(id: number, minutes: number, now = Date.now()): Reminder {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Erteleme süresi geçersiz.')
  const row = getRow(id)
  if (!row) throw new Error('Hatırlatma bulunamadı.')

  // Zamanı geçmişse şimdiden, gelecekteyse kendi zamanından itibaren ertelenir
  const base = Math.max(row.remind_at, now)
  const remindAt = base + Math.round(minutes) * 60_000
  getDb()
    .prepare('UPDATE reminders SET remind_at = ?, sent_at = NULL WHERE id = ?')
    .run(remindAt, id)
  return toReminder(getRow(id))
}

/**
 * Zamanı gelmiş hatırlatmaları döndürür. Tek seferlik olanlar "gösterildi" işaretlenir,
 * tekrarlayanlar bir sonraki zamanlarına atılır ve beklemeye devam eder.
 */
export function takeDueReminders(now: number): Reminder[] {
  const db = getDb()
  return db.transaction(() => {
    const rows = db
      .prepare(
        'SELECT * FROM reminders WHERE sent_at IS NULL AND remind_at <= ? ORDER BY remind_at'
      )
      .all(now) as ReminderRow[]

    const markSent = db.prepare('UPDATE reminders SET sent_at = ? WHERE id = ?')
    const reschedule = db.prepare('UPDATE reminders SET remind_at = ? WHERE id = ?')

    return rows.map((row) => {
      const next = nextReminderTime(row.remind_at, toRepeat(row.repeat), now)
      if (next === null) {
        markSent.run(now, row.id)
        return toReminder({ ...row, sent_at: now })
      }
      reschedule.run(next, row.id)
      // Bildirimde hatırlatmanın çalması gereken zaman görünsün, bir sonraki değil
      return toReminder(row)
    })
  })()
}
