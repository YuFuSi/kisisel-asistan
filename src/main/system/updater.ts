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
  // Hata (internet yok, depoya ulaşılamadı) autoUpdater.logger ile zaten günlüğe yazılıyor;
  // burada sadece yakalanmamış hata olmasın diye yutulur, bir sonraki denemeye kalır
  autoUpdater.checkForUpdates().catch(() => {})
}

/** Paketlenmiş uygulamada güncelleme denetimini başlatır. Durdurmak için dönen fonksiyon çağrılır. */
export function startUpdater(): () => void {
  // Geliştirme modunda app-update.yml yok, denetim anlamsız; paket denemesinde (JARVIS_TEST_DATA)
  // de güncelleme indirilmesin
  if (!app.isPackaged || process.env['JARVIS_TEST_DATA'] === '1') return () => {}

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  // Çıkışta kurulum index.ts'teki kapanış sırasının sonunda installDownloadedUpdate() ile yapılır:
  // kütüphanenin kendi "çıkışta kur"u kurulumdan sonra uygulamayı yeniden açmıyordu (Pıtır
  // güncellenip kapalı kalıyor, kullanıcı "açılmadı" sanıyordu)
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-downloaded', (info) => {
    if (notifiedVersion === info.version) return
    notifiedVersion = info.version
    log.info(`Güncelleme indirildi: ${info.version}`)
    const notification = new Notification({
      title: 'Pıtır güncellemesi hazır',
      body: `Sürüm ${info.version} indirildi. Şimdi kurmak için tıkla; yoksa çıkışta kurulur ve Pıtır yeniden açılır.`,
      icon
    })
    notification.on('click', () => {
      log.info('Kullanıcı bildirimden güncellemeyi kurmayı seçti')
      app.quit()
    })
    notification.show()
  })

  firstTimer = setTimeout(check, FIRST_CHECK_DELAY_MS)
  interval = setInterval(check, CHECK_INTERVAL_MS)
  return () => {
    clearTimeout(firstTimer)
    clearInterval(interval)
  }
}

/**
 * Kapanış sırasının en sonunda çağrılır: indirilmiş güncelleme varsa sessizce kurar ve kurulumdan
 * sonra Pıtır'ı yeniden açar (true döner, çıkışı kütüphane yapar); yoksa false döner.
 */
export function installDownloadedUpdate(): boolean {
  if (!app.isPackaged || !notifiedVersion) return false
  log.info(`Çıkışta güncelleme kuruluyor (${notifiedVersion}), sonra Pıtır yeniden açılacak`)
  autoUpdater.quitAndInstall(true, true)
  return true
}
