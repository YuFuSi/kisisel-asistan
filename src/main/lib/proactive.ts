import type { Task } from '../../shared/api'
import { toLocalDate } from './datetime'

const STALE_DAYS = 3
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000

// SQLite "datetime('now')" UTC döndürür ama işaretsizdir (ör. "2026-09-16 07:47:00");
// işaretsiz bırakılırsa JS bunu yerel saat sanıp yanlış yaşlandırır.
function parseUtc(sqliteDatetime: string): number {
  return new Date(`${sqliteDatetime.replace(' ', 'T')}Z`).getTime()
}

export interface StaleTaskInfo {
  count: number
  oldest: Task
}

/** 3 günden uzun süredir bekleyen (tamamlanmamış) görevler var mı; varsa en eskisini döner */
export function findStaleTasks(tasks: Task[], now: Date, staleMs = STALE_MS): StaleTaskInfo | null {
  const stale = tasks.filter(
    (task) => task.doneAt === null && now.getTime() - parseUtc(task.createdAt) >= staleMs
  )
  if (stale.length === 0) return null
  const oldest = stale.reduce((a, b) => (parseUtc(a.createdAt) < parseUtc(b.createdAt) ? a : b))
  return { count: stale.length, oldest }
}

export interface ProactiveNotification {
  title: string
  body: string
}

export function staleTaskNotificationText(info: StaleTaskInfo): ProactiveNotification {
  const title = 'Bekleyen bir görevin var'
  const body =
    info.count === 1
      ? `"${info.oldest.title}" ${STALE_DAYS} günden uzun süredir bekliyor.`
      : `"${info.oldest.title}" dahil ${info.count} görev ${STALE_DAYS} günden uzun süredir bekliyor.`
  return { title, body }
}

/** Bildirim bugün zaten gösterildiyse tekrar gösterilmez */
export function isProactiveNudgeDue(now: Date, lastShownDate: string | null): boolean {
  return lastShownDate !== toLocalDate(now)
}
