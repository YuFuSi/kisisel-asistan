// Global kısayol (Electron "accelerator") yardımcıları; ana süreç ve arayüz ortak kullanır

export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space'

const PART_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Control: 'Ctrl',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
  Meta: 'Win'
}

/** "CommandOrControl+Shift+Space" → "Ctrl + Shift + Space" */
export function formatAccelerator(accelerator: string): string {
  if (!accelerator) return 'Kapalı'
  return accelerator
    .split('+')
    .map((part) => PART_LABELS[part] ?? part)
    .join(' + ')
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  BracketLeft: '[',
  BracketRight: ']',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete'
}

export interface KeyCombo {
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  code: string
}

/**
 * Klavye olayından accelerator üretir. Türkçe Q/F klavyelerde de doğru çalışsın diye
 * tuşun harfi değil fiziksel konumu (code) kullanılır.
 * En az bir Ctrl/Alt/Win tuşu ve bir normal tuş gerekir; aksi halde null döner.
 */
export function acceleratorFromKeys(combo: KeyCombo): string | null {
  let key: string | null
  if (/^Key[A-Z]$/.test(combo.code)) key = combo.code.slice(3)
  else if (/^Digit[0-9]$/.test(combo.code)) key = combo.code.slice(5)
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(combo.code)) key = combo.code
  else key = NAMED_KEYS[combo.code] ?? null

  if (!key) return null
  // Sadece Shift ile kısayol olmaz (yazı yazarken tetiklenir)
  if (!combo.ctrlKey && !combo.altKey && !combo.metaKey) return null

  const parts: string[] = []
  if (combo.ctrlKey) parts.push('CommandOrControl')
  if (combo.altKey) parts.push('Alt')
  if (combo.shiftKey) parts.push('Shift')
  if (combo.metaKey) parts.push('Super')
  parts.push(key)
  return parts.join('+')
}
