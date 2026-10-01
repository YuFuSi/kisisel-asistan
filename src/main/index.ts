import { app, globalShortcut, powerMonitor } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { closeDb } from './db'
import { interruptStaleRunningRuns } from './data/automations'
import { registerIpcHandlers } from './ipc'
import { startAutomationScheduler, waitForActiveAutomations } from './scheduler/automations'
import { startMemoryScheduler, waitForMemoryProcessing } from './scheduler/memory'
import { startBatteryScheduler } from './scheduler/battery'
import { startBriefScheduler } from './scheduler/brief'
import { safeCheckpoint, startMaintenance } from './scheduler/maintenance'
import { startProactiveScheduler } from './scheduler/proactive'
import { startReminderScheduler } from './scheduler/reminders'
import { getSettings } from './settings'
import { applySettingsPatch } from './system/appSettings'
import { openDatabaseSafely } from './system/database'
import { applyNotch, disposeNotch } from './system/notch'
import { applyDesktopPet, disposeDesktopPet } from './system/desktopPet'
import { installDownloadedUpdate, startUpdater } from './system/updater'
import { initLogging } from './system/logger'
import { disposeGlobalShortcut, initGlobalShortcut } from './system/shortcut'
import { applyOpenAtLogin, wasStartedHidden } from './system/startup'
import { createTray, destroyTray } from './system/tray'
import { disposeVoiceSession, initVoiceSession } from './voice/session'
import { disposeWindowDaemon } from './lib/windowDaemon'
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
  sendCommand,
  showMainWindow
} from './system/window'

let stopReminderScheduler: (() => void) | null = null
let stopBriefScheduler: (() => void) | null = null
let stopMaintenance: (() => void) | null = null
let stopProactiveScheduler: (() => void) | null = null
let stopBatteryScheduler: (() => void) | null = null
let stopAutomationScheduler: (() => void) | null = null
let stopUpdater: (() => void) | null = null
let stopMemoryScheduler: (() => void) | null = null

// Global kısayol: pencere öndeyse gizle, değilse göster ve sohbet kutusuna odaklan
function toggleFromShortcut(): void {
  const window = getMainWindow()
  if (window?.isVisible() && window.isFocused()) {
    window.hide()
    return
  }
  showMainWindow()
  sendCommand('focus-chat')
}

function quitApp(): void {
  markQuitting()
  app.quit()
}

// Jarvis Çentiği kısayolu şimdilik sabit; ana pencerenin kısayolu gibi Ayarlar'dan değiştirilemez
const NOTCH_SHORTCUT = 'CommandOrControl+Shift+J'

function toggleNotch(): void {
  applySettingsPatch({ notchEnabled: !getSettings().notchEnabled })
}

// Veri klasörü sabit: geliştirme (npm run dev / npm start) ve kurulu uygulama aynı veritabanını ve
// şifreleme anahtarını kullansın. Kurulu uygulamanın adı (productName, şu an "Jarvis") farklı olduğu için
// aksi halde %APPDATA%\Jarvis klasörüne yazar ve orada kayıtlı API anahtarları geliştirmede çözülemez.
// Uygulamanın adı değişse de eski veriler bu sayede kaybolmaz.
// Tek kopya kilidi de bu klasöre bağlı olduğundan her şeyden önce ayarlanır.
// 2026-09-30: geliştirme sırasında gerçek veritabanı iki kez karıştı/bozuldu. Bu yüzden geliştirme
// modu (paketlenmemiş uygulama) artık ayrı bir test klasörü kullanır; gerçek veriyle denemek
// gerekirse JARVIS_REAL_DATA=1 ile başlatılır. Paketli sürümü yayından önce denerken gerçek veriye
// dokunmamak için JARVIS_TEST_DATA=1 ile başlatılır (kisisel-asistan-test klasörü).
const dataFolder =
  process.env['JARVIS_TEST_DATA'] === '1'
    ? 'kisisel-asistan-test'
    : app.isPackaged || process.env['JARVIS_REAL_DATA'] === '1'
      ? 'kisisel-asistan'
      : 'kisisel-asistan-dev'
app.setPath('userData', join(app.getPath('appData'), dataFolder))

// Aynı anda tek kopya çalışsın; ikinci kez açılmaya çalışılırsa mevcut pencere öne gelir
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Günlük dosyası: %APPDATA%\kisisel-asistan\logs\main.log
  initLogging()

  app.on('second-instance', () => {
    // Kullanıcı Jarvis zaten açıkken (ör. tepsideyken) yeniden açmaya çalıştı
    console.info('Jarvis zaten açık; mevcut pencere öne getiriliyor')
    showMainWindow()
  })

  app.whenReady().then(() => {
    // Windows bildirimlerinde ve görev çubuğunda uygulama kimliği
    electronApp.setAppUserModelId('com.kisisel.asistan')

    // Geliştirmede F12 ile DevTools açılır, üretimde Ctrl+R yenilemesi kapatılır
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Veritabanı dosyası: %APPDATA%\kisisel-asistan\asistan.db
    // Bozuksa kullanıcıya son yedeği geri yüklemesi önerilir; kullanılamıyorsa uygulama kapanır
    if (!openDatabaseSafely()) {
      quitApp()
      return
    }
    registerIpcHandlers()
    // Önceki oturum otomasyon çalıştırırken kapandıysa (çökme, zorla kapatma) "running" kaydı
    // sonsuza kadar öyle görünmesin
    interruptStaleRunningRuns()

    const settings = getSettings()
    // Windows açılışında başlatıldıysa pencere gösterilmez, tepside bekler
    const mainWindow = createMainWindow({ startHidden: wasStartedHidden() })
    // Windows kapanırken will-quit'e sıra gelmeyebilir; bekleyen veri hemen ana dosyaya yazılsın
    mainWindow.on('session-end', safeCheckpoint)
    powerMonitor.on('suspend', safeCheckpoint)

    createTray({
      onOpen: showMainWindow,
      onNewChat: () => {
        showMainWindow()
        sendCommand('new-chat')
      },
      onToggleOpenAtLogin: (enabled) => applySettingsPatch({ openAtLogin: enabled }),
      onToggleNotch: toggleNotch,
      onQuit: quitApp
    })
    initGlobalShortcut(settings.globalShortcut, toggleFromShortcut)
    if (!globalShortcut.register(NOTCH_SHORTCUT, toggleNotch)) {
      console.warn(`Çentik kısayolu kaydedilemedi: ${NOTCH_SHORTCUT}`)
    }
    applyOpenAtLogin(settings.openAtLogin)
    applyNotch(settings.notchEnabled)
    applyDesktopPet(settings.desktopPetEnabled)
    stopReminderScheduler = startReminderScheduler()
    stopBriefScheduler = startBriefScheduler()
    stopMaintenance = startMaintenance()
    stopProactiveScheduler = startProactiveScheduler()
    stopBatteryScheduler = startBatteryScheduler()
    stopAutomationScheduler = startAutomationScheduler()
    stopUpdater = startUpdater()
    stopMemoryScheduler = startMemoryScheduler()
    // "Hey Jarvis" açıksa modeller yüklenir ve arayüz mikrofonu dinlemeye başlar
    initVoiceSession()
  })

  // Çöken süreçler günlüğe yazılsın (normal kapanışlar hariç)
  app.on('render-process-gone', (_event, _contents, details) => {
    if (details.reason !== 'clean-exit') {
      console.error(`Arayüz süreci kapandı: ${details.reason} (kod ${details.exitCode})`)
    }
  })
  app.on('child-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') {
      console.error(`Yardımcı süreç kapandı (${details.type}): ${details.reason}`)
    }
  })

  // Terminalden Ctrl+C veya sonlandırma sinyali gelirse düzgün kapan; veritabanı kapatılsın
  process.on('SIGINT', quitApp)
  process.on('SIGTERM', quitApp)

  app.on('before-quit', markQuitting)

  // Buraya sadece "kapatınca tepside kal" kapalıyken veya çıkış sırasında gelinir
  app.on('window-all-closed', () => app.quit())

  // Kapanış sırasında devam eden bir otomasyon olabilir (model çağrısı dakikalar sürebilir);
  // closeDb()'den önce bitmesi (en fazla belirli bir süre) beklenir, yoksa yarım kalan çalıştırma
  // kapanmış veritabanına yazmaya çalışır. will-quit varsayılan olarak beklemeyi desteklemediği
  // için ilk seferinde engellenip asıl kapanış asenkron işler bitince tekrar tetiklenir.
  const AUTOMATION_SHUTDOWN_WAIT_MS = 15_000
  let quitting = false
  app.on('will-quit', (event) => {
    if (quitting) return
    quitting = true
    event.preventDefault()
    console.info('Jarvis kapanıyor')
    // Kapanış adımlarından biri takılırsa uygulama penceresiz asılı kalmasın
    setTimeout(() => {
      console.warn('Kapanış 30 sn içinde bitmedi, zorla çıkılıyor')
      app.exit(0)
    }, 30_000).unref()
    ;(async () => {
      disposeGlobalShortcut()
      disposeNotch()
      disposeDesktopPet()
      destroyTray()
      stopReminderScheduler?.()
      stopBriefScheduler?.()
      stopMaintenance?.()
      stopProactiveScheduler?.()
      stopBatteryScheduler?.()
      stopAutomationScheduler?.()
      stopUpdater?.()
      stopMemoryScheduler?.()
      await waitForActiveAutomations(AUTOMATION_SHUTDOWN_WAIT_MS)
      // Yarım kalan hafıza işlemesi kısa süre beklenir; bitmezse sonraki açılışta baştan yapılır
      await waitForMemoryProcessing(5_000)
      // Arka plandaki whisper ve Piper programları da kapansın
      disposeVoiceSession()
      disposeWindowDaemon()
      closeDb()
      // İndirilmiş güncelleme varsa kurulup Jarvis yeniden açılır; yoksa normal çıkış
      if (!installDownloadedUpdate()) app.quit()
    })().catch((err: unknown) => {
      console.error('Kapanış sırasında hata:', err)
      app.exit(0)
    })
  })
}
