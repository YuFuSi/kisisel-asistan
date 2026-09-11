import { globalShortcut } from 'electron'
import { formatAccelerator } from '../../shared/shortcut'

// Şu an işletim sistemine kayıtlı kısayol (null: kayıtlı değil)
let registered: string | null = null
// Kısayol ayarlanırken geçici olarak devre dışı mı
let suspended = false
let onTrigger: () => void = () => {}

function tryRegister(accelerator: string): boolean {
  try {
    return globalShortcut.register(accelerator, () => onTrigger())
  } catch {
    // Geçersiz tuş kombinasyonu
    return false
  }
}

/** Uygulama açılırken bir kez çağrılır. Kısayol başka uygulamadaysa sadece uyarı yazar. */
export function initGlobalShortcut(accelerator: string, trigger: () => void): void {
  onTrigger = trigger
  if (!accelerator) return
  if (tryRegister(accelerator)) registered = accelerator
  else console.warn(`Global kısayol kaydedilemedi: ${accelerator}`)
}

/**
 * Kısayolu değiştirir. Yeni kısayol alınamazsa eskisi korunur ve Türkçe hata fırlatılır.
 * Boş değer kısayolu kapatır.
 */
export function changeGlobalShortcut(accelerator: string): void {
  suspendGlobalShortcut(false)
  if (accelerator === registered) return
  if (accelerator && !tryRegister(accelerator)) {
    throw new Error(
      `${formatAccelerator(accelerator)} kısayolu kullanılamıyor; başka bir uygulama kullanıyor olabilir. Farklı bir tuş kombinasyonu dene.`
    )
  }
  if (registered) globalShortcut.unregister(registered)
  registered = accelerator || null
}

/** Ayarlarda yeni kısayol kaydedilirken mevcut kısayol tetiklenmesin diye geçici olarak kapatır */
export function suspendGlobalShortcut(value: boolean): void {
  if (value === suspended) return
  suspended = value
  if (!registered) return
  if (value) {
    globalShortcut.unregister(registered)
  } else if (!tryRegister(registered)) {
    registered = null
  }
}

export function isShortcutActive(): boolean {
  return registered !== null
}

export function disposeGlobalShortcut(): void {
  globalShortcut.unregisterAll()
  registered = null
}
