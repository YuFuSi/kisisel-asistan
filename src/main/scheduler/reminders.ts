import { Notification } from 'electron'
import { takeDueReminders } from '../data/reminders'
import { notifyDataChanged } from '../events'
import { showJarvisNotice } from '../system/jarvisNotice'
import type { Reminder } from '../../shared/api'

const CHECK_INTERVAL_MS = 15_000
// Zamanı bundan daha önce geçmiş hatırlatmalar (ör. uygulama kapalıyken) "kaçırılan" olarak gösterilir
const MISSED_AFTER_MS = 5 * 60_000

function showReminder(reminder: Reminder, now: number): void {
  const missed = now - reminder.remindAt > MISSED_AFTER_MS
  const time = new Date(reminder.remindAt).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
  showJarvisNotice({
    title: missed ? 'Kaçırılan hatırlatma' : 'Hatırlatma',
    body: missed ? `${reminder.message} (${time})` : reminder.message,
    spoken: `Hatırlatma: ${reminder.message}`,
    silent: missed
  })
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
