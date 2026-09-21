import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getStoredValue, setStoredValue } from '../settings'

// Ekranın sağ üst köşesinde duran, saydam, her zaman üstte küçük Jarvis paneli.
// Ayrı bir electron-vite giriş noktası gerekmez: aynı renderer bundle'ı #hud
// işaretiyle açılır, main.tsx bu durumda HudApp'i render eder.

const WIDTH = 300
const HEIGHT = 130
const MARGIN = 16
const POSITION_KEY = 'hudPosition'

let hudWindow: BrowserWindow | null = null

// Kullanıcının bıraktığı yer hatırlanır; ekran değiştiyse ve kayıtlı yer artık görünmüyorsa sağ üst köşe
function hudPosition(): { x: number; y: number } {
  const saved = getStoredValue(POSITION_KEY)
  if (saved) {
    const [x, y] = saved.split(',').map(Number)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const visible = screen.getAllDisplays().some(({ workArea: a }) => {
        return (
          x >= a.x - WIDTH / 2 &&
          x <= a.x + a.width - WIDTH / 2 &&
          y >= a.y &&
          y <= a.y + a.height - 40
        )
      })
      if (visible) return { x, y }
    }
  }
  const { x, y, width } = screen.getPrimaryDisplay().workArea
  return { x: x + width - WIDTH - MARGIN, y: y + MARGIN }
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
  window.on('moved', () => {
    const [px, py] = window.getPosition()
    setStoredValue(POSITION_KEY, `${px},${py}`)
  })
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
