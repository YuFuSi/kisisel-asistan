import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// Ekranın sağ üst köşesinde duran, saydam, her zaman üstte küçük Jarvis paneli.
// Ayrı bir electron-vite giriş noktası gerekmez: aynı renderer bundle'ı #hud
// işaretiyle açılır, main.tsx bu durumda HudApp'i render eder.

const WIDTH = 260
const HEIGHT = 150
const MARGIN = 16

let hudWindow: BrowserWindow | null = null

function hudPosition(): { x: number; y: number } {
  const { width } = screen.getPrimaryDisplay().workArea
  return { x: width - WIDTH - MARGIN, y: MARGIN }
}

function createHudWindow(): BrowserWindow {
  const { x, y } = hudPosition()
  const window = new BrowserWindow({
    x,
    y,
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.on('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (hudWindow === window) hudWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#hud`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'hud' })
  }
  return window
}

export function isHudOpen(): boolean {
  return hudWindow !== null
}

/** HUD kapalıysa açar, açıksa kapatır */
export function toggleHud(): void {
  if (hudWindow) {
    hudWindow.close()
    return
  }
  hudWindow = createHudWindow()
}

export function closeHud(): void {
  hudWindow?.close()
}

export function disposeHud(): void {
  hudWindow?.destroy()
  hudWindow = null
}
