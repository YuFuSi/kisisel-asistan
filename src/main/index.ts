import { app } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { closeDb, initDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { startBriefScheduler } from './scheduler/brief'
import { startReminderScheduler } from './scheduler/reminders'
import { getSettings } from './settings'
import { applySettingsPatch } from './system/appSettings'
import { disposeGlobalShortcut, initGlobalShortcut } from './system/shortcut'
import { applyOpenAtLogin, wasStartedHidden } from './system/startup'
import { createTray, destroyTray } from './system/tray'
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
  sendCommand,
  showMainWindow
} from './system/window'

let stopReminderScheduler: (() => void) | null = null
let stopBriefScheduler: (() => void) | null = null

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

// Aynı anda tek kopya çalışsın; ikinci kez açılmaya çalışılırsa mevcut pencere öne gelir
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    // Windows bildirimlerinde ve görev çubuğunda uygulama kimliği
    electronApp.setAppUserModelId('com.kisisel.asistan')

    // Geliştirmede F12 ile DevTools açılır, üretimde Ctrl+R yenilemesi kapatılır
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Veritabanı dosyası: %APPDATA%\kisisel-asistan\asistan.db
    initDatabase(join(app.getPath('userData'), 'asistan.db'))
    registerIpcHandlers()

    const settings = getSettings()
    // Windows açılışında başlatıldıysa pencere gösterilmez, tepside bekler
    createMainWindow({ startHidden: wasStartedHidden() })
    createTray({
      onOpen: showMainWindow,
      onNewChat: () => {
        showMainWindow()
        sendCommand('new-chat')
      },
      onToggleOpenAtLogin: (enabled) => applySettingsPatch({ openAtLogin: enabled }),
      onQuit: quitApp
    })
    initGlobalShortcut(settings.globalShortcut, toggleFromShortcut)
    applyOpenAtLogin(settings.openAtLogin)
    stopReminderScheduler = startReminderScheduler()
    stopBriefScheduler = startBriefScheduler()
  })

  app.on('before-quit', markQuitting)

  // Buraya sadece "kapatınca tepside kal" kapalıyken veya çıkış sırasında gelinir
  app.on('window-all-closed', () => app.quit())

  app.on('will-quit', () => {
    disposeGlobalShortcut()
    destroyTray()
    stopReminderScheduler?.()
    stopBriefScheduler?.()
    closeDb()
  })
}
