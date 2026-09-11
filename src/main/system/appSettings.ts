import { getApiKeyStatus, getSettings, updateSettings } from '../settings'
import { notifyDataChanged } from '../events'
import { changeGlobalShortcut, isShortcutActive } from './shortcut'
import { applyOpenAtLogin, isLoginItemSupported } from './startup'
import { refreshTrayMenu } from './tray'
import type { SettingsPatch, SettingsView } from '../../shared/api'

export function getSettingsView(): SettingsView {
  return {
    ...getSettings(),
    hasApiKey: getApiKeyStatus(),
    loginItemSupported: isLoginItemSupported(),
    shortcutActive: isShortcutActive()
  }
}

/**
 * Ayarı kaydeder ve sisteme uygular: global kısayol, Windows ile başlama, tepsi menüsü.
 * Yeni kısayol alınamazsa kısayol ayarı eski haline döner ve hata fırlatılır.
 */
export function applySettingsPatch(patch: SettingsPatch): SettingsView {
  const previous = getSettings()
  const next = updateSettings(patch)

  if (typeof patch.globalShortcut === 'string') {
    try {
      changeGlobalShortcut(next.globalShortcut)
    } catch (err) {
      updateSettings({ globalShortcut: previous.globalShortcut })
      throw err
    }
  }
  if (typeof patch.openAtLogin === 'boolean') {
    applyOpenAtLogin(next.openAtLogin)
    refreshTrayMenu()
  }

  notifyDataChanged('settings')
  return getSettingsView()
}
