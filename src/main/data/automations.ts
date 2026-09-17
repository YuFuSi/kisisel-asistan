import { getDb } from '../db'
import { resolveReminderTime } from '../lib/repeat'
import type {
  Automation,
  AutomationInput,
  AutomationPatch,
  AutomationRun,
  RepeatRule,
  RoutineAllowance
} from '../../shared/api'

interface AutomationRow {
  id: number
  name: string
  prompt: string
  time_of_day: string
  repeat: string
  allowance: string
  enabled: number
  next_run_at: number
  last_run_at: number | null
  created_at: string
}

interface AutomationRunRow {
  id: number
  automation_id: number
  started_at: number
  finished_at: number | null
  status: string
  summary: string
  skipped_tools: string
}

const REPEAT_RULES: RepeatRule[] = ['none', 'daily', 'weekdays', 'weekly']
const ALLOWANCE_LEVELS: RoutineAllowance[] = ['none', 'write', 'all']
const RUN_STATUSES = ['running', 'done', 'error'] as const

const toRepeat = (value: string): RepeatRule =>
  (REPEAT_RULES as string[]).includes(value) ? (value as RepeatRule) : 'none'

const toAllowance = (value: string): RoutineAllowance =>
  (ALLOWANCE_LEVELS as string[]).includes(value) ? (value as RoutineAllowance) : 'none'

const toStatus = (value: string): AutomationRun['status'] =>
  (RUN_STATUSES as readonly string[]).includes(value) ? (value as AutomationRun['status']) : 'error'

const toAutomation = (row: AutomationRow): Automation => ({
  id: row.id,
  name: row.name,
  prompt: row.prompt,
  timeOfDay: row.time_of_day,
  repeat: toRepeat(row.repeat),
  allowance: toAllowance(row.allowance),
  enabled: row.enabled === 1,
  nextRunAt: row.next_run_at,
  lastRunAt: row.last_run_at,
  createdAt: row.created_at
})

const toAutomationRun = (row: AutomationRunRow): AutomationRun => ({
  id: row.id,
  automationId: row.automation_id,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: toStatus(row.status),
  summary: row.summary,
  skippedTools: JSON.parse(row.skipped_tools) as AutomationRun['skippedTools']
})

function cleanName(name: string): string {
  const value = name.trim()
  if (!value) throw new Error('Rutin adı boş olamaz.')
  return value
}

function cleanPrompt(prompt: string): string {
  const value = prompt.trim()
  if (!value) throw new Error('Rutinin ne yapacağı boş olamaz.')
  return value
}

function cleanTimeOfDay(timeOfDay: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) throw new Error('Saat SS:DD biçiminde olmalı.')
  return timeOfDay
}

function cleanRepeat(repeat: RepeatRule | undefined): RepeatRule {
  if (repeat === undefined) return 'none'
  if (!REPEAT_RULES.includes(repeat)) throw new Error('Geçersiz tekrar kuralı.')
  return repeat
}

function cleanAllowance(allowance: RoutineAllowance | undefined): RoutineAllowance {
  if (allowance === undefined) return 'none'
  if (!ALLOWANCE_LEVELS.includes(allowance)) throw new Error('Geçersiz izin seviyesi.')
  return allowance
}

/** "HH:mm" ve tekrar kuralına göre bir sonraki çalışma zamanı (epoch ms). `now`'dan sonradır. */
export function computeNextRun(timeOfDay: string, repeat: RepeatRule, now: number): number {
  const date = resolveReminderTime(timeOfDay, repeat, now)
  if (!date) throw new Error('Saat çözümlenemedi.')
  return date.getTime()
}

export function listAutomations(): Automation[] {
  const rows = getDb()
    .prepare('SELECT * FROM automations ORDER BY next_run_at, id')
    .all() as AutomationRow[]
  return rows.map(toAutomation)
}

export function requireAutomation(id: number): Automation {
  const row = getDb().prepare('SELECT * FROM automations WHERE id = ?').get(id) as
    AutomationRow | undefined
  if (!row) throw new Error(`${id} numaralı rutin bulunamadı.`)
  return toAutomation(row)
}

export function createAutomation(input: AutomationInput, now = Date.now()): Automation {
  const timeOfDay = cleanTimeOfDay(input.timeOfDay)
  const repeat = cleanRepeat(input.repeat)
  const nextRunAt = computeNextRun(timeOfDay, repeat, now)
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO automations (name, prompt, time_of_day, repeat, allowance, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      cleanName(input.name),
      cleanPrompt(input.prompt),
      timeOfDay,
      repeat,
      cleanAllowance(input.allowance),
      nextRunAt
    )
  return requireAutomation(Number(lastInsertRowid))
}

export function updateAutomation(id: number, patch: AutomationPatch, now = Date.now()): Automation {
  const current = requireAutomation(id)
  const name = patch.name !== undefined ? cleanName(patch.name) : current.name
  const prompt = patch.prompt !== undefined ? cleanPrompt(patch.prompt) : current.prompt
  const timeOfDay =
    patch.timeOfDay !== undefined ? cleanTimeOfDay(patch.timeOfDay) : current.timeOfDay
  const repeat = patch.repeat !== undefined ? cleanRepeat(patch.repeat) : current.repeat
  const allowance =
    patch.allowance !== undefined ? cleanAllowance(patch.allowance) : current.allowance
  const enabled = patch.enabled !== undefined ? patch.enabled : current.enabled
  // Saat veya tekrar değiştiyse sıradaki zaman yeniden hesaplanır
  const nextRunAt =
    patch.timeOfDay !== undefined || patch.repeat !== undefined
      ? computeNextRun(timeOfDay, repeat, now)
      : current.nextRunAt

  getDb()
    .prepare(
      `UPDATE automations
       SET name = ?, prompt = ?, time_of_day = ?, repeat = ?, allowance = ?, enabled = ?, next_run_at = ?
       WHERE id = ?`
    )
    .run(name, prompt, timeOfDay, repeat, allowance, enabled ? 1 : 0, nextRunAt, id)
  return requireAutomation(id)
}

export function deleteAutomation(id: number): void {
  getDb().prepare('DELETE FROM automations WHERE id = ?').run(id)
}

/**
 * Zamanı gelmiş (enabled=1, next_run_at <= now) rutinleri döner. Tek seferlik (repeat: 'none')
 * bir kere çalışınca kapanır (enabled=0, silinmez — geçmişi listede görünür kalır); tekrarlayan
 * bir sonraki zamanına atlar. Bildirimde/çalıştırmada kullanılacak rutin listesi, güncel hâliyle
 * (yeni next_run_at ile) döner.
 */
export function takeDueAutomations(now: number): Automation[] {
  const db = getDb()
  return db.transaction(() => {
    const rows = db
      .prepare(
        'SELECT * FROM automations WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at'
      )
      .all(now) as AutomationRow[]

    const disable = db.prepare('UPDATE automations SET enabled = 0, last_run_at = ? WHERE id = ?')
    const reschedule = db.prepare(
      'UPDATE automations SET next_run_at = ?, last_run_at = ? WHERE id = ?'
    )

    return rows.map((row) => {
      const automation = toAutomation(row)
      if (automation.repeat === 'none') {
        disable.run(now, row.id)
        return { ...automation, enabled: false, lastRunAt: now }
      }
      const nextRunAt = computeNextRun(automation.timeOfDay, automation.repeat, now)
      reschedule.run(nextRunAt, now, row.id)
      return { ...automation, nextRunAt, lastRunAt: now }
    })
  })()
}

export function recordAutomationRunStart(automationId: number, now = Date.now()): number {
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO automation_runs (automation_id, started_at, status) VALUES (?, ?, ?)')
    .run(automationId, now, 'running')
  return Number(lastInsertRowid)
}

export function finishAutomationRun(
  runId: number,
  result: {
    status: 'done' | 'error'
    summary: string
    skippedTools: AutomationRun['skippedTools']
  },
  now = Date.now()
): void {
  getDb()
    .prepare(
      'UPDATE automation_runs SET finished_at = ?, status = ?, summary = ?, skipped_tools = ? WHERE id = ?'
    )
    .run(now, result.status, result.summary, JSON.stringify(result.skippedTools), runId)
}

export function listAutomationRuns(automationId: number): AutomationRun[] {
  const rows = getDb()
    .prepare('SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC')
    .all(automationId) as AutomationRunRow[]
  return rows.map(toAutomationRun)
}
