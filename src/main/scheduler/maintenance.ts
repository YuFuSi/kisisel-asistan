import { checkpointDb } from '../db'
import { pruneActivity } from '../data/activity'
import { runDailyBackup } from '../system/database'

// WAL'deki değişiklikler bu aralıkla ana veritabanı dosyasına aktarılır
const CHECKPOINT_INTERVAL_MS = 5 * 60_000
const BACKUP_CHECK_INTERVAL_MS = 60 * 60_000
// Açılışı yavaşlatmasın diye ilk yedek kontrolü biraz sonra yapılır
const FIRST_BACKUP_DELAY_MS = 60_000
// Etkinlik kaydı 180 gün saklanır
const ACTIVITY_RETENTION_MS = 180 * 86_400_000

/** Hata vermeden WAL aktarması (uyku ve Windows kapanışında da çağrılır) */
export function safeCheckpoint(): void {
  try {
    checkpointDb()
  } catch (err) {
    console.error('Veritabanı WAL aktarması başarısız:', err)
  }
}

/** Düzenli bakım işleri: WAL aktarma, günlük yedek, eski etkinlik kayıtlarını silme */
export function startMaintenance(): () => void {
  const backup = (): void => {
    runDailyBackup().catch((err) => console.error('Otomatik yedek alınamadı:', err))
  }

  try {
    const removed = pruneActivity(Date.now() - ACTIVITY_RETENTION_MS)
    if (removed > 0) console.info(`${removed} eski etkinlik kaydı silindi`)
  } catch (err) {
    console.error('Eski etkinlik kayıtları silinemedi:', err)
  }

  const checkpointTimer = setInterval(safeCheckpoint, CHECKPOINT_INTERVAL_MS)
  const firstBackup = setTimeout(backup, FIRST_BACKUP_DELAY_MS)
  const backupTimer = setInterval(backup, BACKUP_CHECK_INTERVAL_MS)
  return () => {
    clearInterval(checkpointTimer)
    clearTimeout(firstBackup)
    clearInterval(backupTimer)
  }
}
