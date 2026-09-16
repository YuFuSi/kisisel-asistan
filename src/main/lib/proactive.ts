import type { Reminder, Task } from '../../shared/api'
import { toLocalDate } from './datetime'

const STALE_DAYS = 3
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000
const STALE_REMINDER_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const BACKLOG_MIN_OPEN = 5

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

export interface StaleReminderInfo {
  count: number
  oldest: Reminder
}

/**
 * Tek seferlik (repeat: 'none') bir hatırlatma çaldıktan (sentAt dolu) 24 saat sonra hâlâ
 * silinmemişse bulur. Tekrarlayan hatırlatmalar hariç: onlar sürekli "çalmış" durumda olabilir,
 * bu normal ve bir sorun değil.
 */
export function findStaleFiredReminders(
  reminders: Reminder[],
  now: Date,
  staleMs = STALE_REMINDER_MS
): StaleReminderInfo | null {
  const stale = reminders.filter(
    (reminder): reminder is Reminder & { sentAt: number } =>
      reminder.repeat === 'none' &&
      reminder.sentAt !== null &&
      now.getTime() - reminder.sentAt >= staleMs
  )
  if (stale.length === 0) return null
  const oldest = stale.reduce((a, b) => (a.sentAt < b.sentAt ? a : b))
  return { count: stale.length, oldest }
}

export function staleReminderNotificationText(info: StaleReminderInfo): ProactiveNotification {
  const title = 'Unutulmuş bir hatırlatma var'
  const body =
    info.count === 1
      ? `"${info.oldest.message}" hatırlatması çaldı ama hâlâ duruyor. Silmeyi mi unuttun?`
      : `"${info.oldest.message}" dahil ${info.count} hatırlatma çaldı ama hâlâ duruyor.`
  return { title, body }
}

/** Haftalık bildirim son gösterildiğinden bu yana en az 7 gün geçtiyse tekrar gösterilebilir */
export function isWeeklyNudgeDue(now: Date, lastShownDate: string | null): boolean {
  if (!lastShownDate) return true
  const last = new Date(`${lastShownDate}T00:00:00`)
  return now.getTime() - last.getTime() >= WEEK_MS
}

export interface BacklogGrowthInfo {
  openCount: number
}

/**
 * Görev listesi sadece büyüyor mu: son 7 günde hiç görev tamamlanmamış ama açık (tamamlanmamış)
 * görev sayısı en az 5 ise. Mevcut "3 gündür bekleyen tek görev" kuralından farklı olarak tek bir
 * eski kayda değil, genel bir birikme eğilimine bakar.
 */
export function detectBacklogGrowth(
  tasks: Task[],
  now: Date,
  windowMs = WEEK_MS,
  minOpen = BACKLOG_MIN_OPEN
): BacklogGrowthInfo | null {
  const openCount = tasks.filter((task) => task.doneAt === null).length
  if (openCount < minOpen) return null

  const completedInWindow = tasks.filter(
    (task) => task.doneAt !== null && now.getTime() - new Date(task.doneAt).getTime() < windowMs
  ).length
  if (completedInWindow > 0) return null

  return { openCount }
}

export function backlogGrowthNotificationText(info: BacklogGrowthInfo): ProactiveNotification {
  return {
    title: 'Görev listen büyüyor',
    body: `${info.openCount} açık görevin var ve son 7 gündür hiçbirini tamamlamadın. Listeye göz atmak ister misin?`
  }
}

export interface EmbeddingBacklogInfo {
  missingCount: number
}

/**
 * Anlamsal arama açıkken embedding'i eksik (henüz indekslenmemiş) hafıza/not kaydı var mı.
 * Ollama kapalı kalması gibi durumlarda arka plandaki otomatik indeksleme birikip kalabilir.
 */
export function detectEmbeddingBacklog(missingCount: number): EmbeddingBacklogInfo | null {
  return missingCount > 0 ? { missingCount } : null
}

export function embeddingBacklogNotificationText(
  info: EmbeddingBacklogInfo
): ProactiveNotification {
  return {
    title: 'Anlamsal arama güncel değil',
    body: `${info.missingCount} kayıt henüz indekslenmedi. Hafıza Merkezi veya Notlar'daki "İndeksle" düğmesine basmayı unutma.`
  }
}
