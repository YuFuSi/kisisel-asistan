import { Menu, Tray, nativeImage } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { getSettings } from '../settings'
import { isLoginItemSupported } from './startup'

export interface TrayActions {
  onOpen: () => void
  onNewChat: () => void
  onToggleOpenAtLogin: (enabled: boolean) => void
  onToggleNotch: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let actions: TrayActions | null = null

export function createTray(trayActions: TrayActions): void {
  actions = trayActions
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 32, height: 32 }))
  tray.setToolTip('Jarvis')
  // Tek tıkla pencere açılır; sağ tıkla menü
  tray.on('click', () => trayActions.onOpen())
  refreshTrayMenu()
}

// Menüdeki onay işaretleri ayarlara bağlı olduğu için ayar değişince yeniden kurulur
export function refreshTrayMenu(): void {
  if (!tray || !actions) return
  const { onOpen, onNewChat, onToggleOpenAtLogin, onToggleNotch, onQuit } = actions
  const { openAtLogin } = getSettings()

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Jarvis'i aç", click: onOpen },
      { label: 'Yeni sohbet', click: onNewChat },
      { label: 'Jarvis Çentiğini aç/kapat', click: onToggleNotch },
      { type: 'separator' },
      {
        label: 'Windows açılınca başlat',
        type: 'checkbox',
        checked: openAtLogin,
        enabled: isLoginItemSupported(),
        click: (item) => onToggleOpenAtLogin(item.checked)
      },
      { type: 'separator' },
      { label: 'Çıkış', click: onQuit }
    ])
  )
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
