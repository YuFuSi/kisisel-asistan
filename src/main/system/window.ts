import { BrowserWindow, Notification, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { getSettings, hasFlag, setFlag } from '../settings'
import { formatAccelerator } from '../../shared/shortcut'
import type { AppCommand } from '../../shared/api'

let mainWindow: BrowserWindow | null = null
// Gerçekten çıkılıyorsa (tepsiden Çıkış, Windows kapanışı) pencere gizlenmez, kapanır
let quitting = false

export function markQuitting(): void {
  quitting = true
}

// Sadece web linklerini varsayılan tarayıcıda aç (file:// vb. açılmasın)
function openExternalSafe(url: string): void {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

// İlk kez tepsiye gizlenince kullanıcıya uygulamanın kapanmadığını bir kez söyle
function showTrayHintOnce(): void {
  if (hasFlag('trayHintShown')) return
  setFlag('trayHintShown')
  const { globalShortcut } = getSettings()
  const shortcut = globalShortcut ? ` ya da ${formatAccelerator(globalShortcut)} tuşlarına bas` : ''
  new Notification({
    title: 'Jarvis arka planda çalışıyor',
    body: `Hatırlatmaların gelmeye devam edecek. Açmak için sistem tepsisindeki simgeye tıkla${shortcut}.`,
    icon
  }).show()
}

// Sesli komut için mikrofon izni; başka izinler (kamera, konum vb.) reddedilir
function allowMicrophoneOnly(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media')
  })
}

export function createMainWindow(options: { startHidden: boolean }): BrowserWindow {
  allowMicrophoneOnly()

  const window = new BrowserWindow({
    // Ana Sayfa'daki küre ve sağdaki kartlar yan yana sığsın
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    title: 'Jarvis',
    // Renkler main.css'teki --color-app ve --color-muted ile aynı
    backgroundColor: '#0b0c0f',
    // Kendi başlık çubuğumuzu çiziyoruz; kapat/küçült düğmelerini Windows çiziyor
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0c0f', symbolColor: '#a0a6b4', height: 40 },
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = window

  window.on('ready-to-show', () => {
    if (!options.startHidden) window.show()
  })

  // Pencere kapatılınca (X): ayar açıksa uygulama kapanmaz, sistem tepsisine gizlenir
  window.on('close', (event) => {
    if (quitting || !getSettings().closeToTray) return
    event.preventDefault()
    window.hide()
    showTrayHintOnce()
  })
  // Windows kapanırken veya oturum kapatılırken pencere gizlenmeye çalışıp kapanışı engellemesin
  window.on('session-end', markQuitting)
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  // target="_blank" linkler varsayılan tarayıcıda açılsın
  window.webContents.setWindowOpenHandler((details) => {
    openExternalSafe(details.url)
    return { action: 'deny' }
  })
  // Uygulama penceresi başka bir sayfaya gitmesin; dış linkler tarayıcıda açılsın
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault()
      openExternalSafe(url)
    }
  })

  // Geliştirme modunda Vite sunucusunu (anlık yenileme), üretimde derlenmiş dosyayı yükle
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return window
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function showMainWindow(): void {
  const window = mainWindow
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.moveTop()
  window.focus()
}

// Tepsi menüsü veya kısayoldan gelen komutu arayüze ilet
export function sendCommand(command: AppCommand): void {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:command', command)
  }
}
