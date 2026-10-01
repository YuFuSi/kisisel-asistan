import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { daemonForegroundIsFullscreen } from '../lib/windowDaemon'
import { getMainWindow } from './window'

// Masaüstü pet: görev çubuğunun hemen üstünde, ekran genişliğinde saydam bir şerit pencere.
// Robot bu şeridin içinde yürür, bakınır, uyur. Fare robotun üstünde değilken tıklamalar alttaki
// programlara geçer (setIgnoreMouseEvents + forward: fare hareketi yine de sayfaya ulaşır).
// Tam ekran bir program öndeyken ya da Jarvis'in kendi penceresi odaktayken gizlenir.
// Ana pencereyle aynı renderer bundle'ı #pet işaretiyle açılır.

const HEIGHT = 260
const POLL_MS = 1500

let petWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined
let hidden = false

function petBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - HEIGHT,
    width: workArea.width,
    height: HEIGHT
  }
}

function createPetWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...petBounds(),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      // Odak almayan pencere "gizli" sayılıp animasyonlar donmasın (çentikteki sorunun aynısı)
      backgroundThrottling: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setIgnoreMouseEvents(true, { forward: true })
  window.on('ready-to-show', () => {
    if (!hidden) window.showInactive()
  })
  window.on('closed', () => {
    if (petWindow === window) petWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#pet`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'pet' })
  }
  return window
}

// Tam ekran program öndeyse ya da Jarvis penceresi odaktaysa (orada zaten robot var) gizlenir
async function checkVisibility(): Promise<void> {
  if (!petWindow) return
  let fullscreen = false
  try {
    fullscreen = await daemonForegroundIsFullscreen()
  } catch {
    // Pencere yardımcısı cevap vermezse görünür kalır
  }
  const main = getMainWindow()
  const mainFocused = !!main && !main.isDestroyed() && main.isVisible() && main.isFocused()
  const shouldHide = fullscreen || mainFocused
  if (!petWindow || shouldHide === hidden) return
  hidden = shouldHide
  if (shouldHide) petWindow.hide()
  else petWindow.showInactive()
}

function onDisplayChanged(): void {
  petWindow?.setBounds(petBounds())
}

/** Ayara göre masaüstü peti açar ya da kapatır */
export function applyDesktopPet(enabled: boolean): void {
  if (enabled && !petWindow) {
    petWindow = createPetWindow()
    pollTimer = setInterval(() => void checkVisibility(), POLL_MS)
    screen.on('display-metrics-changed', onDisplayChanged)
  } else if (!enabled && petWindow) {
    disposeDesktopPet()
  }
}

/** Fare robotun üstündeyken tıklamaları alır, değilken alttaki programlara geçirir */
export function setDesktopPetInteractive(interactive: boolean): void {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.setIgnoreMouseEvents(!interactive, { forward: true })
}

export function disposeDesktopPet(): void {
  clearInterval(pollTimer)
  pollTimer = undefined
  screen.removeListener('display-metrics-changed', onDisplayChanged)
  petWindow?.destroy()
  petWindow = null
  hidden = false
}
