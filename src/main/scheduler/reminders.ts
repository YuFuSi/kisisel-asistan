import { BrowserWindow, Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { takeDueReminders } from '../data/reminders'
import { notifyDataChanged } from '../events'
import type { Reminder } from '../../shared/api'

const CHECK_INTERVAL_MS = 15_000
// Zamanı bundan daha önce geçmiş hatırlatmalar (ör. uygulama kapalıyken) "kaçırılan" olarak gösterilir
const MISSED_AFTER_MS = 5 * 60_000

// Bildirim nesneleri çöp toplayıcıya gitmesin (yoksa tıklama olayı kaybolabilir)
const visibleNotifications = new Set<Notification>()

function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function showReminder(reminder: Reminder, now: number): void {
  const missed = now - reminder.remindAt > MISSED_AFTER_MS
  const time = new Date(reminder.remindAt).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
  const notification = new Notification({
    title: missed ? 'Kaçırılan hatırlatma' : 'Hatırlatma',
    body: missed ? `${reminder.message} (${time})` : reminder.message,
    icon
  })
  visibleNotifications.add(notification)
  const release = (): void => {
    visibleNotifications.delete(notification)
  }
  notification.on('click', () => {
    release()
    focusMainWindow()
  })
  notification.on('close', release)
  notification.show()
}

// Zamanı gelen hatırlatmaları düzenli aralıklarla kontrol edip Windows bildirimi gösterir.
// Durdurmak için dönen fonksiyon çağrılır.
export function startReminderScheduler(): () => void {
  if (!Notification.isSupported()) {
    console.warn('Bu sistemde bildirimler desteklenmiyor; hatırlatmalar gösterilemeyecek.')
  }

  const check = (): void => {
    try {
      const now = Date.now()
      const due = takeDueReminders(now)
      if (due.length === 0) return
      for (const reminder of due) showReminder(reminder, now)
      notifyDataChanged('reminders')
    } catch (err) {
      console.error('Hatırlatma kontrolü başarısız:', err)
    }
  }

  check()
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
