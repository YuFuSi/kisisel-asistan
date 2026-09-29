import { listMemoriesMissingEmbedding } from '../data/memories'
import { listNotesMissingEmbedding } from '../data/notes'
import { listReminders } from '../data/reminders'
import { listTasks } from '../data/tasks'
import { toLocalDate } from '../lib/datetime'
import {
  backlogGrowthNotificationText,
  detectBacklogGrowth,
  detectEmbeddingBacklog,
  embeddingBacklogNotificationText,
  findStaleFiredReminders,
  findStaleTasks,
  isProactiveNudgeDue,
  isWeeklyNudgeDue,
  staleReminderNotificationText,
  staleTaskNotificationText,
  type ProactiveNotification
} from '../lib/proactive'
import { getSettings, getStoredValue, setStoredValue } from '../settings'
import { showJarvisNotice } from '../system/jarvisNotice'
import { sendCommand } from '../system/window'

// Otomasyon motorunu (Tur J) beklemeden sabit kurallar: uzun süredir bekleyen bir görev, unutulmuş
// bir hatırlatma, sürekli büyüyen bir görev listesi veya indekslenmemiş kayıt birikmesi varsa
// bildirim gösterir. Otomasyon motorunun küçük bir önizlemesi. Her kural kendi "son gösterildi"
// anahtarıyla ayrı gater; biri gösterilse diğerlerinin gösterilmesini engellemez.
const CHECK_INTERVAL_MS = 60_000
const STALE_TASK_KEY = 'proactiveStaleTaskLastShown'
const STALE_REMINDER_KEY = 'proactiveStaleReminderLastShown'
const BACKLOG_GROWTH_KEY = 'proactiveBacklogGrowthLastShown'
const EMBEDDING_BACKLOG_KEY = 'proactiveEmbeddingBacklogLastShown'

function showProactiveNudge(notification: ProactiveNotification, onClick: () => void): void {
  // Jarvis'in kendi fark ettiği şeyler: sesli söylenirken başlık yerine doğrudan içerik
  showJarvisNotice({ ...notification, spoken: notification.body, onClick })
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

function checkBacklogGrowth(now: Date): void {
  if (!isWeeklyNudgeDue(now, getStoredValue(BACKLOG_GROWTH_KEY) ?? null)) return

  const growth = detectBacklogGrowth(listTasks(), now)
  if (!growth) return

  setStoredValue(BACKLOG_GROWTH_KEY, toLocalDate(now))
  try {
    showProactiveNudge(backlogGrowthNotificationText(growth), () => sendCommand('open-tasks'))
  } catch (err) {
    console.error('Proaktif bildirim gösterilemedi (büyüyen görev listesi):', err)
  }
}

function checkEmbeddingBacklog(now: Date): void {
  if (!getSettings().semanticSearchEnabled) return
  if (!isProactiveNudgeDue(now, getStoredValue(EMBEDDING_BACKLOG_KEY) ?? null)) return

  const missingCount = listMemoriesMissingEmbedding().length + listNotesMissingEmbedding().length
  const backlog = detectEmbeddingBacklog(missingCount)
  if (!backlog) return

  setStoredValue(EMBEDDING_BACKLOG_KEY, toLocalDate(now))
  try {
    showProactiveNudge(embeddingBacklogNotificationText(backlog), () => {})
  } catch (err) {
    console.error('Proaktif bildirim gösterilemedi (indekslenmemiş kayıt):', err)
  }
}

/**
 * Her dakika uzun süredir bekleyen görev, unutulmuş hatırlatma, sürekli büyüyen görev listesi
 * veya indekslenmemiş kayıt birikmesi olup olmadığına bakar; her kural kendi sıklığında (günlük
 * veya haftalık) en fazla bir kez bildirir.
 */
export function startProactiveScheduler(): () => void {
  const check = (): void => {
    // Kurallar kendi hatalarını yakalıyor ama veritabanı okumaları (ör. yedekten geri yükleme
    // sırasında kapalı veritabanı) setInterval içinde yakalanmamış hata olarak düşmesin
    try {
      const now = new Date()
      checkStaleTasks(now)
      checkStaleReminders(now)
      checkBacklogGrowth(now)
      checkEmbeddingBacklog(now)
    } catch (err) {
      console.error('Proaktif kontrol yapılamadı:', err)
    }
  }

  check()
  const timer = setInterval(check, CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
