import { Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { listReminders } from '../data/reminders'
import { listTasks } from '../data/tasks'
import { toLocalDate } from '../lib/datetime'
import {
  findStaleFiredReminders,
  findStaleTasks,
  isProactiveNudgeDue,
  staleReminderNotificationText,
  staleTaskNotificationText,
  type ProactiveNotification
} from '../lib/proactive'
import { getStoredValue, setStoredValue } from '../settings'
import { sendCommand, showMainWindow } from '../system/window'

// Otomasyon motorunu (Tur J) beklemeden sabit kurallar: uzun süredir bekleyen bir görev veya
// unutulmuş bir hatırlatma varsa günde bir kez bildirim gösterir. Otomasyon motorunun küçük bir
// önizlemesi. Her kural kendi "son gösterildi" anahtarıyla ayrı gater; biri o gün gösterilse
// diğerinin gösterilmesini engellemez.
const CHECK_INTERVAL_MS = 60_000
const STALE_TASK_KEY = 'proactiveStaleTaskLastShown'
const STALE_REMINDER_KEY = 'proactiveStaleReminderLastShown'

// Aynı anda gösterilmiş bildirimleri tıklanana kadar canlı tutar (yoksa GC'lenip tıklama olayını
// kaçırabilir); notification.close() ile kendiliğinden temizlenir.
const visibleNotifications = new Set<Notification>()

function showProactiveNudge(notification: ProactiveNotification, onClick: () => void): void {
  const win = new Notification({ title: notification.title, body: notification.body, icon })
  visibleNotifications.add(win)
  win.on('click', () => {
    visibleNotifications.delete(win)
    showMainWindow()
    onClick()
  })
  win.on('close', () => visibleNotifications.delete(win))
  win.show()
}

function checkStaleTasks(now: Date): void {
  if (!isProactiveNudgeDue(now, getStoredValue(STALE_TASK_KEY) ?? null)) return

  const stale = findStaleTasks(listTasks(), now)
  if (!stale) return

  // Önce işaretlenir: bildirim gösterilse de gösterilmese de aynı gün tekrar denenmesin
  setStoredValue(STALE_TASK_KEY, toLocalDate(now))
  try {
    showProactiveNudge(staleTaskNotificationText(stale), () => sendCommand('open-tasks'))
  } catch (err) {
    console.error('Proaktif bildirim gösterilemedi (bekleyen görev):', err)
  }
}

function checkStaleReminders(now: Date): void {
  if (!isProactiveNudgeDue(now, getStoredValue(STALE_REMINDER_KEY) ?? null)) return

  const stale = findStaleFiredReminders(listReminders(), now)
  if (!stale) return

  setStoredValue(STALE_REMINDER_KEY, toLocalDate(now))
  try {
    showProactiveNudge(staleReminderNotificationText(stale), () => sendCommand('open-tasks'))
  } catch (err) {
    console.error('Proaktif bildirim gösterilemedi (unutulmuş hatırlatma):', err)
  }
}

/**
 * Her dakika uzun süredir bekleyen görev veya unutulmuş hatırlatma olup olmadığına bakar;
 * her kural için günde en fazla bir kez bildirir.
 */
export function startProactiveScheduler(): () => void {
  const check = (): void => {
    const now = new Date()
    checkStaleTasks(now)
    checkStaleReminders(now)
  }

  check()
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
