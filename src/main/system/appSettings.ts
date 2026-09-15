import { getSecretStatus, getSettings, getUnreadableSecrets, updateSettings } from '../settings'
import { notifyDataChanged } from '../events'
import { changeGlobalShortcut, isShortcutActive } from './shortcut'
import { applyOpenAtLogin, isLoginItemSupported } from './startup'
import { refreshTrayMenu } from './tray'
import { refreshVoiceSession } from '../voice/session'
import type { SettingsPatch, SettingsView } from '../../shared/api'

export function getSettingsView(): SettingsView {
  return {
    ...getSettings(),
    hasSecret: getSecretStatus(),
    loginItemSupported: isLoginItemSupported(),
    shortcutActive: isShortcutActive(),
    unreadableSecrets: getUnreadableSecrets()
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

  // "Hey Jarvis" açılıp kapanınca dinleme durumu hemen değişsin
  if (typeof patch.wakeWordEnabled === 'boolean') refreshVoiceSession()

  notifyDataChanged('settings')
  return getSettingsView()
}
