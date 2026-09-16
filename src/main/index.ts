import { app, globalShortcut, powerMonitor } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { closeDb } from './db'
import { registerIpcHandlers } from './ipc'
import { startBriefScheduler } from './scheduler/brief'
import { safeCheckpoint, startMaintenance } from './scheduler/maintenance'
import { startProactiveScheduler } from './scheduler/proactive'
import { startReminderScheduler } from './scheduler/reminders'
import { getSettings } from './settings'
import { applySettingsPatch } from './system/appSettings'
import { openDatabaseSafely } from './system/database'
import { disposeHud, toggleHud } from './system/hud'
import { initLogging } from './system/logger'
import { disposeGlobalShortcut, initGlobalShortcut } from './system/shortcut'
import { applyOpenAtLogin, wasStartedHidden } from './system/startup'
import { createTray, destroyTray } from './system/tray'
import { disposeVoiceSession, initVoiceSession } from './voice/session'
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

// HUD kısayolu şimdilik sabit; ana pencerenin kısayolu gibi Ayarlar'dan değiştirilemez
const HUD_SHORTCUT = 'CommandOrControl+Shift+J'

// Veri klasörü sabit: geliştirme (npm run dev / npm start) ve kurulu uygulama aynı veritabanını ve
// şifreleme anahtarını kullansın. Kurulu uygulamanın adı (productName, şu an "Jarvis") farklı olduğu için
// aksi halde %APPDATA%\Jarvis klasörüne yazar ve orada kayıtlı API anahtarları geliştirmede çözülemez.
// Uygulamanın adı değişse de eski veriler bu sayede kaybolmaz.
// Tek kopya kilidi de bu klasöre bağlı olduğundan her şeyden önce ayarlanır.
app.setPath('userData', join(app.getPath('appData'), 'kisisel-asistan'))

// Aynı anda tek kopya çalışsın; ikinci kez açılmaya çalışılırsa mevcut pencere öne gelir
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Günlük dosyası: %APPDATA%\kisisel-asistan\logs\main.log
  initLogging()

  app.on('second-instance', () => showMainWindow())

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
      onToggleHud: toggleHud,
      onQuit: quitApp
    })
    initGlobalShortcut(settings.globalShortcut, toggleFromShortcut)
    if (!globalShortcut.register(HUD_SHORTCUT, toggleHud)) {
      console.warn(`HUD kısayolu kaydedilemedi: ${HUD_SHORTCUT}`)
    }
    applyOpenAtLogin(settings.openAtLogin)
    stopReminderScheduler = startReminderScheduler()
    stopBriefScheduler = startBriefScheduler()
    stopMaintenance = startMaintenance()
    stopProactiveScheduler = startProactiveScheduler()
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

  app.on('will-quit', () => {
    disposeGlobalShortcut()
    disposeHud()
    destroyTray()
    stopReminderScheduler?.()
    stopBriefScheduler?.()
    stopMaintenance?.()
    stopProactiveScheduler?.()
    // Arka plandaki whisper ve Piper programları da kapansın
    disposeVoiceSession()
    closeDb()
  })
}
