import { app } from 'electron'

// Windows açılışında bu argümanla başlatılır; pencere gösterilmeden tepside beklenir
const HIDDEN_ARG = '--hidden'

/**
 * Windows ile başlama sadece kurulu (paketlenmiş) uygulamada kullanılır.
 * Geliştirme modunda electron.exe'nin başlangıca kaydedilmesi istenmez.
 */
export function isLoginItemSupported(): boolean {
  return app.isPackaged
}

export function applyOpenAtLogin(enabled: boolean): void {
  if (!isLoginItemSupported()) return
  app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_ARG] })
}

export function wasStartedHidden(): boolean {
  return process.argv.includes(HIDDEN_ARG)
}
