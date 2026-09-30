import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { daemonForegroundIsFullscreen } from '../lib/windowDaemon'

// Jarvis Çentiği: ana ekranın üst ortasında duran, saydam, her zaman üstte küçük pencere.
// İçinde gözlü damla durur; onay beklenince, iş bitince veya araç çalışırken aşağı doğru açılır.
// Pencere her zaman içeriği kadardır (arayüz boyunu bildirir); böylece boş alan ekranı kaplamaz ve
// belgeler çentiğe sürüklenip bırakılabilir (tıklamayı alta geçiren pencereye bırakma çalışmıyor).
// Ana pencereyle aynı renderer bundle'ı #notch işaretiyle açılır.

// Başlangıç boyu (küçük damla); arayüz yüklenince gerçek boyunu bildirir
const START_WIDTH = 100
const START_HEIGHT = 48
const MAX_WIDTH = 480
const MAX_HEIGHT = 420
const FULLSCREEN_POLL_MS = 2000
let size = { width: START_WIDTH, height: START_HEIGHT }

let notchWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined
let hiddenForFullscreen = false

function notchBounds(): Electron.Rectangle {
  const { bounds } = screen.getPrimaryDisplay()
  return {
    x: Math.round(bounds.x + (bounds.width - size.width) / 2),
    y: bounds.y,
    width: size.width,
    height: size.height
  }
}

function createNotchWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...notchBounds(),
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
    // Tıklanınca odağı başka programdan çalmasın; düğmeler yine de çalışır
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.on('ready-to-show', () => {
    if (!hiddenForFullscreen) window.showInactive()
  })
  window.on('closed', () => {
    if (notchWindow === window) notchWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#notch`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'notch' })
  }
  return window
}

// Tam ekran bir program (oyun, video, sunum) öndeyken çentik gizlenir
async function checkFullscreen(): Promise<void> {
  if (!notchWindow) return
  let fullscreen = false
  try {
    fullscreen = await daemonForegroundIsFullscreen()
  } catch {
    return
  }
  if (!notchWindow || fullscreen === hiddenForFullscreen) return
  hiddenForFullscreen = fullscreen
  if (fullscreen) notchWindow.hide()
  else notchWindow.showInactive()
}

function onDisplayChanged(): void {
  notchWindow?.setBounds(notchBounds())
}

/** Ayara göre çentiği açar ya da kapatır */
export function applyNotch(enabled: boolean): void {
  if (enabled && !notchWindow) {
    notchWindow = createNotchWindow()
    pollTimer = setInterval(() => void checkFullscreen(), FULLSCREEN_POLL_MS)
    screen.on('display-metrics-changed', onDisplayChanged)
  } else if (!enabled && notchWindow) {
    disposeNotch()
  }
}

/** Arayüzün bildirdiği içerik boyuna göre pencereyi ekranın üst ortasında yeniden boyutlandırır */
export function resizeNotch(width: number, height: number): void {
  if (!notchWindow || notchWindow.isDestroyed()) return
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  size = {
    width: Math.min(MAX_WIDTH, Math.max(40, Math.ceil(width))),
    height: Math.min(MAX_HEIGHT, Math.max(24, Math.ceil(height)))
  }
  notchWindow.setBounds(notchBounds())
}

export function disposeNotch(): void {
  clearInterval(pollTimer)
  pollTimer = undefined
  screen.removeListener('display-metrics-changed', onDisplayChanged)
  notchWindow?.destroy()
  notchWindow = null
  hiddenForFullscreen = false
}
