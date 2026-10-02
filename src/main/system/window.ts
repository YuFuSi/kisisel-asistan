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

// İzin sadece uygulamanın kendi sayfalarına verilir (geliştirmede vite sunucusu, pakette file://);
// dışarıdan yüklenen bir sayfa/çerçeve kamera veya mikrofon alamasın
function isAppUrl(url: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl))
}

// Sesli komut için mikrofon, el kontrolü için kamera izni ('media' ikisini de kapsar);
// başka izinler (konum, bildirim penceresi vb.) reddedilir
function allowMicrophoneOnly(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'media' && isAppUrl(details.requestingUrl))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    if (permission !== 'media') return false
    return isAppUrl(requestingOrigin)
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
      // Preload sadece contextBridge/ipcRenderer kullanıyor; arayüz ele geçirilse bile Node erişimi olmasın
      sandbox: true
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
    if (!quitting) console.warn('Ana pencere kapandı ama uygulama kapanmıyor')
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
  // Ana pencere bir şekilde kapanmış ama uygulama açık kalmışsa (ör. çentik penceresi açık olduğu
  // için uygulama kapanmadı) kısayol, bildirim veya yeniden açma hiçbir şey yapmıyordu; kullanıcı
  // Jarvis'i hiç açamıyordu. Pencere yoksa yeniden oluşturulur.
  if (!window || window.isDestroyed()) {
    console.warn('Ana pencere yoktu, yeniden oluşturuluyor')
    createMainWindow({ startHidden: false })
    return
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.moveTop()
  window.focus()
}

/** Çentiğe bırakılan belgeleri ana pencereye iletir; ana pencere yeni sohbete ekler */
export function sendAttachPaths(paths: string[]): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) return
  const send = (): void => window.webContents.send('app:attach-paths', paths)
  // Pencere yeni oluşturulduysa sayfa yüklenince gönderilir
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send)
  else send()
}

/** Masaüstü arkadaştan yazılan soru: ana penceredeki sohbet sayfası yeni sohbette gönderir */
export function sendAsk(text: string): void {
  // Ana pencere kapanmışsa (tepsiye gizlemek kapalıyken) gizli olarak yeniden oluşturulur;
  // soru yine arka planda gönderilir, cevabı robot söyler
  const window =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : createMainWindow({ startHidden: true })
  const send = (): void => window.webContents.send('app:ask', text)
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send)
  else send()
}

// Bir bildirim gösterildi: Ana Sayfa'daki küre kısa süre nabız atsın
export function notifyPulse(): void {
  // Ana pencere ve (açıksa) çentik: ikisinin küresi de nabız atar
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('app:command', 'notified')
  }
}

// Tepsi menüsü veya kısayoldan gelen komutu arayüze ilet
export function sendCommand(command: AppCommand): void {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('app:command', command)
  }
}
