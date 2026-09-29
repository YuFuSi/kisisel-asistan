import { backfillMemoryEmbeddings } from '../ai/memoryEmbeddings'
import { backfillNoteEmbeddings } from '../ai/noteEmbeddings'
import { listMemoriesMissingEmbedding } from '../data/memories'
import { listNotesMissingEmbedding } from '../data/notes'
import { listReminders } from '../data/reminders'
import { listTasks } from '../data/tasks'
import { notifyDataChanged } from '../events'
import { toLocalDate } from '../lib/datetime'
import {
  backlogGrowthNotificationText,
  detectBacklogGrowth,
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
// bir hatırlatma veya sürekli büyüyen bir görev listesi varsa bildirim gösterir; indekslenmemiş
// kayıtları ise sessizce kendisi indeksler. Otomasyon motorunun küçük bir önizlemesi. Her kural kendi "son gösterildi"
// anahtarıyla ayrı gater; biri gösterilse diğerlerinin gösterilmesini engellemez.
const CHECK_INTERVAL_MS = 60_000
const STALE_TASK_KEY = 'proactiveStaleTaskLastShown'
const STALE_REMINDER_KEY = 'proactiveStaleReminderLastShown'
const BACKLOG_GROWTH_KEY = 'proactiveBacklogGrowthLastShown'

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

// İndekslenmemiş kayıtlar: kullanıcıya "İndeksle" diye bildirim göstermek yerine Jarvis kendisi
// sessizce indeksler (teknik bir iş, kullanıcıya düşmemeli). Ollama kapalıysa bir sonraki denemede.
const BACKFILL_INTERVAL_MS = 10 * 60_000
let backfilling = false
let lastBackfillAt = 0

function checkEmbeddingBacklog(now: Date): void {
  if (!getSettings().semanticSearchEnabled) return
  if (backfilling || now.getTime() - lastBackfillAt < BACKFILL_INTERVAL_MS) return
  const missing = listMemoriesMissingEmbedding().length + listNotesMissingEmbedding().length
  if (missing === 0) return

  backfilling = true
  lastBackfillAt = now.getTime()
  Promise.all([backfillMemoryEmbeddings(), backfillNoteEmbeddings()])
    .then(([memories, notes]) => {
      if (memories + notes === 0) return
      console.info(`Arka planda indekslendi: ${memories} hafıza, ${notes} not`)
      notifyDataChanged('memories')
      notifyDataChanged('notes')
    })
    .catch((err: unknown) => console.warn('Arka plan indeksleme yapılamadı:', err))
    .finally(() => {
      backfilling = false
    })
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
