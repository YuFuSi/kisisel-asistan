import { Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { listTasks } from '../data/tasks'
import { toLocalDate } from '../lib/datetime'
import { findStaleTasks, isProactiveNudgeDue, staleTaskNotificationText } from '../lib/proactive'
import { getStoredValue, setStoredValue } from '../settings'
import { sendCommand, showMainWindow } from '../system/window'

// Otomasyon motorunu (Tur J) beklemeden tek, sabit bir kural: uzun süredir bekleyen
// bir görev varsa günde bir kez bildirim gösterir. Otomasyon motorunun küçük bir önizlemesi.
const CHECK_INTERVAL_MS = 60_000
const LAST_SHOWN_KEY = 'proactiveStaleTaskLastShown'

let visibleNotification: Notification | null = null

function showStaleTaskNudge(title: string, body: string): void {
  const notification = new Notification({ title, body, icon })
  visibleNotification = notification
  notification.on('click', () => {
    visibleNotification = null
    showMainWindow()
    sendCommand('open-tasks')
  })
  notification.on('close', () => {
    if (visibleNotification === notification) visibleNotification = null
  })
  notification.show()
}

/** Her dakika uzun süredir bekleyen görev olup olmadığına bakar; günde en fazla bir kez bildirir. */
export function startProactiveScheduler(): () => void {
  const check = (): void => {
    const now = new Date()
    if (!isProactiveNudgeDue(now, getStoredValue(LAST_SHOWN_KEY) ?? null)) return

    const stale = findStaleTasks(listTasks(), now)
    if (!stale) return

    // Önce işaretlenir: bildirim gösterilse de gösterilmese de aynı gün tekrar denenmesin
    setStoredValue(LAST_SHOWN_KEY, toLocalDate(now))
    const { title, body } = staleTaskNotificationText(stale)
    try {
      showStaleTaskNudge(title, body)
    } catch (err) {
      console.error('Proaktif bildirim gösterilemedi:', err)
    }
  }

  check()
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
