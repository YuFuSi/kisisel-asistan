import { app, Notification } from 'electron'
import log from 'electron-log/main'
import electronUpdater from 'electron-updater'
import icon from '../../../resources/icon.png?asset'

// Yeni sürümler açık YuFuSi/jarvis-releases deposunun GitHub sürümlerinden gelir (kaynak kod
// gizli depoda kalır; electron-builder.yml → publish). Güncelleme arka planda indirilir ve
// uygulama kapanınca kurulur; kullanıcıya sadece bir kez bildirim gösterilir.
const { autoUpdater } = electronUpdater

// Açılıştan biraz sonra (başlangıcı yavaşlatmasın) ve sonra 6 saatte bir bakılır
const FIRST_CHECK_DELAY_MS = 60_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let firstTimer: ReturnType<typeof setTimeout> | undefined
let interval: ReturnType<typeof setInterval> | undefined
let notifiedVersion: string | null = null

function check(): void {
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    // İnternet yoksa veya sürüm deposuna ulaşılamazsa sessizce bir sonraki denemeye kalır
    console.warn('Güncelleme denetlenemedi:', err instanceof Error ? err.message : err)
  })
}

/** Paketlenmiş uygulamada güncelleme denetimini başlatır. Durdurmak için dönen fonksiyon çağrılır. */
export function startUpdater(): () => void {
  // Geliştirme modunda app-update.yml yok, denetim anlamsız
  if (!app.isPackaged) return () => {}

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    if (notifiedVersion === info.version) return
    notifiedVersion = info.version
    log.info(`Güncelleme indirildi: ${info.version}`)
    new Notification({
      title: 'Jarvis güncellemesi hazır',
      body: `Sürüm ${info.version} indirildi. Uygulamadan çıkınca (tepsi > Çıkış) kurulacak.`,
      icon
    }).show()
  })
  autoUpdater.on('error', (err) => console.warn('Güncelleme hatası:', err.message))

  firstTimer = setTimeout(check, FIRST_CHECK_DELAY_MS)
  interval = setInterval(check, CHECK_INTERVAL_MS)
  return () => {
    clearTimeout(firstTimer)
    clearInterval(interval)
  }
}
