import { app, dialog, type BrowserWindow, type MessageBoxOptions } from 'electron'
import { join } from 'node:path'
import { checkIntegrity, closeDb, initDatabase, isDbOpen } from '../db'
import {
  createBackup,
  dailyBackupName,
  listBackups,
  pruneBackups,
  replaceDatabaseFile,
  safetyBackupName,
  summarizeBackup
} from '../db/backup'
import { logDirectory } from './logger'
import { markQuitting } from './window'
import type { BackupInfo } from '../../shared/api'

const TITLE = 'Pıtır'

export const databasePath = (): string => join(app.getPath('userData'), 'asistan.db')
export const backupDirectory = (): string => join(app.getPath('userData'), 'backups')

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// "İçinde 6 sohbet, 19 mesaj, 2 hafıza var; son mesaj 30 Eylül 2026 21:10." Okunamazsa boş metin
function describeBackup(path: string): string {
  const summary = summarizeBackup(path)
  if (!summary) return ''
  const last = summary.lastMessageAt
    ? `; son mesaj ${formatTime(Date.parse(`${summary.lastMessageAt.replace(' ', 'T')}Z`))}`
    : ''
  return `İçinde ${summary.conversations} sohbet, ${summary.messages} mesaj, ${summary.memories} hafıza var${last}. `
}

/**
 * Veritabanını açar ve bütünlüğünü kontrol eder. Sorun varsa kullanıcıya son yedeği geri yüklemeyi
 * önerir. Veritabanı kullanılamıyorsa false döner; bu durumda uygulama kapanmalı.
 */
export function openDatabaseSafely(): boolean {
  const path = databasePath()
  let problem: string
  try {
    initDatabase(path)
    const result = checkIntegrity()
    if (result === 'ok') return true
    problem = result
  } catch (err) {
    problem = errorText(err)
  }
  console.error('Veritabanında sorun bulundu:', problem)

  const opened = isDbOpen()
  const latest = listBackups(backupDirectory())[0]
  if (!latest) {
    dialog.showMessageBoxSync({
      type: opened ? 'warning' : 'error',
      title: TITLE,
      message: opened ? 'Veritabanında sorun bulundu' : 'Veritabanı açılamadı',
      detail:
        `Geri yüklenecek yedek bulunamadı. ${opened ? 'Uygulama açılacak ama bazı kayıtlar okunamayabilir.' : 'Uygulama kapanacak.'}` +
        `\n\nAyrıntılar günlük dosyasında: ${logDirectory()}`
    })
    return opened
  }

  const response = dialog.showMessageBoxSync({
    type: 'error',
    title: TITLE,
    message: 'Veritabanında sorun bulundu',
    detail:
      `Son yedek: ${formatTime(latest.createdAt)}. ${describeBackup(join(backupDirectory(), latest.name))}` +
      `Geri yüklenirse bu tarihten sonraki kayıtlar kaybolur. ` +
      `Bozuk dosya silinmez, "asistan-bozuk-..." adıyla saklanır.\n\nAyrıntı: ${problem.slice(0, 300)}`,
    buttons: ['Son yedeği geri yükle', opened ? 'Yine de devam et' : 'Çık'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response !== 0) return opened

  try {
    closeDb()
    const stamp = safetyBackupName(new Date()).replace('geri-yukleme-oncesi-', '')
    replaceDatabaseFile(
      path,
      join(backupDirectory(), latest.name),
      join(app.getPath('userData'), `asistan-bozuk-${stamp}`)
    )
    initDatabase(path)
    console.info(`Veritabanı yedekten geri yüklendi: ${latest.name}`)
    return true
  } catch (err) {
    console.error('Yedekten geri yüklenemedi:', err)
    dialog.showErrorBox(
      'Yedek geri yüklenemedi',
      `${errorText(err)}\n\nAyrıntılar günlük dosyasında: ${logDirectory()}`
    )
    return false
  }
}

let backupRunning = false

/** Bugünün yedeği yoksa alır ve saklama süresi dolan yedekleri siler */
export async function runDailyBackup(): Promise<void> {
  if (backupRunning || !isDbOpen()) return
  const dir = backupDirectory()
  const name = dailyBackupName(new Date())
  if (listBackups(dir).some((backup) => backup.name === name)) return

  backupRunning = true
  try {
    await createBackup(dir, name)
    const removed = pruneBackups(dir)
    console.info(
      `Otomatik yedek alındı: ${name}${removed.length ? `; silinen eski yedekler: ${removed.join(', ')}` : ''}`
    )
  } finally {
    backupRunning = false
  }
}

/** Ayarlar'daki "Şimdi yedekle"; bugünün yedeği varsa güncellenir */
export async function createBackupNow(): Promise<BackupInfo> {
  const dir = backupDirectory()
  const info = await createBackup(dir, dailyBackupName(new Date()))
  pruneBackups(dir)
  console.info(`Elle yedek alındı: ${info.name}`)
  return info
}

/**
 * Seçilen yedeği geri yükler. Önce onay penceresi gösterilir; mevcut veri ayrıca yedeklenir,
 * sonra dosya değiştirilip uygulama yeniden başlatılır. Vazgeçilirse false döner.
 */
export async function restoreBackup(window: BrowserWindow | null, name: string): Promise<boolean> {
  const dir = backupDirectory()
  // Sadece yedek klasöründeki gerçek yedekler seçilebilir (başka bir dosya yolu verilemez)
  const backup = listBackups(dir).find((item) => item.name === name)
  if (!backup) throw new Error('Yedek bulunamadı.')

  const options: MessageBoxOptions = {
    type: 'warning',
    title: 'Yedekten geri yükle',
    message: 'Yedek geri yüklensin mi?',
    detail:
      `${formatTime(backup.createdAt)} tarihli yedek yüklenecek ve uygulama yeniden başlayacak. ` +
      describeBackup(join(dir, backup.name)) +
      'Bu tarihten sonraki sohbetler, görevler ve notlar kaybolur.\n\n' +
      'Mevcut veriler önce "Geri yükleme öncesi" yedeği olarak saklanır; fikrini değiştirirsen ona dönebilirsin.',
    buttons: ['Geri yükle ve yeniden başlat', 'Vazgeç'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  }
  const { response } = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
  if (response !== 0) return false

  await createBackup(dir, safetyBackupName(new Date()))
  closeDb()
  try {
    replaceDatabaseFile(databasePath(), join(dir, name))
  } catch (err) {
    // Dosya değiştirilemediyse mevcut veritabanıyla çalışmaya devam et
    initDatabase(databasePath())
    throw err
  }

  console.info(`Yedekten geri yüklendi: ${name}; uygulama yeniden başlatılıyor`)
  markQuitting()
  app.relaunch()
  app.exit(0)
  return true
}
