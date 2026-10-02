import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { classifyActivity, type Activity } from '../../shared/activity'
import { daemonForegroundInfo } from '../lib/windowDaemon'
import { getMainWindow } from './window'

// Masaüstü arkadaş: görev çubuğunun hemen üstünde, ekran genişliğinde saydam bir şerit pencere.
// Jarvis robotu burada yaşar: dolaşır, uyur, onay ister, iş bitince haber verir ve kullanıcının
// ne yaptığına (video, oyun, kod...) tepki verir. Çentiğin yerini alır.
// Fare robotun üstünde değilken tıklamalar alttaki programlara geçer (setIgnoreMouseEvents + forward).
// Öndeki pencere sadece başlık ve program adıyla izlenir; ekran görüntüsü alınmaz, hiçbir şey dışarı gitmez.
// Ana pencereyle aynı renderer bundle'ı #companion işaretiyle açılır.

// Robot + üstündeki konuşma balonu (onay düğmeleri dahil) sığacak yükseklik
const HEIGHT = 460
const POLL_MS = 2500

let companionWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined
let hidden = false
let lastActivity: Activity = { kind: 'other', detail: '', fullscreen: false }

function companionBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x,
    y: workArea.y + workArea.height - HEIGHT,
    width: workArea.width,
    height: HEIGHT
  }
}

function createCompanionWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...companionBounds(),
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
    // Beklenmedik kapanışta da zamanlayıcı ve ekran dinleyicisi kalmasın
    if (companionWindow === window) releaseResources()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#companion`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'companion' })
  }
  return window
}

const sameActivity = (a: Activity, b: Activity): boolean =>
  a.kind === b.kind && a.detail === b.detail && a.fullscreen === b.fullscreen

// Öndeki pencereye bakıp aktiviteyi günceller ve görünürlüğü ayarlar:
// - Jarvis penceresi öndeyse gizlenir (orada zaten robot var)
// - Tam ekranda sadece video izlenirken görünür (robot da izler); oyunda ve sunumda gizlenir
async function poll(): Promise<void> {
  if (!companionWindow) return
  let activity = lastActivity
  try {
    const info = await daemonForegroundInfo()
    activity = classifyActivity(info)
  } catch {
    // Pencere yardımcısı cevap vermezse son bilinen durumla devam edilir
  }
  if (!companionWindow || companionWindow.isDestroyed()) return

  if (activity.kind !== 'jarvis' && !sameActivity(activity, lastActivity)) {
    if (activity.kind !== lastActivity.kind) {
      // Sadece tür yazılır; pencere başlıkları günlüğe girmez (gizlilik)
      console.info(
        `Masaüstü arkadaş: aktivite ${activity.kind}${activity.fullscreen ? ' (tam ekran)' : ''}`
      )
    }
    lastActivity = activity
    companionWindow.webContents.send('companion:activity', activity)
    // Toplantıda (ekran paylaşımı olabilir) robot ve balonları paylaşılan görüntüye girmesin
    companionWindow.setContentProtection(activity.kind === 'meeting')
  }

  const main = getMainWindow()
  const mainFocused = !!main && !main.isDestroyed() && main.isVisible() && main.isFocused()
  const shouldHide = mainFocused || (activity.fullscreen && activity.kind !== 'video')
  if (shouldHide === hidden) return
  hidden = shouldHide
  // Gizliyken arayüz dolaşmayı, yorumları ve sesi durdursun (backgroundThrottling kapalı olduğu
  // için sayfa kendini hep "görünür" sanıyor); tıklama geçirgenliği de geri açılsın
  companionWindow.webContents.send('companion:visible', !shouldHide)
  if (shouldHide) {
    companionWindow.setIgnoreMouseEvents(true, { forward: true })
    companionWindow.hide()
  } else companionWindow.showInactive()
}

function onDisplayChanged(): void {
  companionWindow?.setBounds(companionBounds())
}

/** Ayara göre masaüstü arkadaşı açar ya da kapatır */
export function applyCompanion(enabled: boolean): void {
  if (enabled && !companionWindow) {
    releaseResources()
    companionWindow = createCompanionWindow()
    pollTimer = setInterval(() => void poll(), POLL_MS)
    screen.on('display-metrics-changed', onDisplayChanged)
  } else if (!enabled && companionWindow) {
    disposeCompanion()
  }
}

/** Fare robotun ya da balonun üstündeyken tıklamaları alır, değilken alttaki programlara geçirir */
export function setCompanionInteractive(interactive: boolean): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  companionWindow.setIgnoreMouseEvents(!interactive, { forward: true })
}

/** Arayüz açılınca son bilinen aktiviteyi ister */
export function currentActivity(): Activity {
  return lastActivity
}

// Pencereden bağımsız, tekrar çağrılabilir temizlik
function releaseResources(): void {
  clearInterval(pollTimer)
  pollTimer = undefined
  screen.removeListener('display-metrics-changed', onDisplayChanged)
  companionWindow = null
  hidden = false
}

export function disposeCompanion(): void {
  const window = companionWindow
  releaseResources()
  if (window && !window.isDestroyed()) window.destroy()
}
