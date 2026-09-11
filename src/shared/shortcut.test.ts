import { describe, expect, it } from 'vitest'
import { acceleratorFromKeys, formatAccelerator, type KeyCombo } from './shortcut'

const keys = (code: string, mods: Partial<KeyCombo> = {}): KeyCombo => ({
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  code,
  ...mods
})

describe('acceleratorFromKeys', () => {
  it('değiştirici tuşlarla kısayol üretir', () => {
    expect(acceleratorFromKeys(keys('Space', { ctrlKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+Space'
    )
    expect(acceleratorFromKeys(keys('KeyI', { ctrlKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+I'
    )
    expect(acceleratorFromKeys(keys('Digit5', { metaKey: true }))).toBe('Super+5')
    expect(acceleratorFromKeys(keys('F9', { altKey: true }))).toBe('Alt+F9')
  })

  it('Ctrl/Alt/Win yoksa veya tuş desteklenmiyorsa null döner', () => {
    expect(acceleratorFromKeys(keys('KeyA'))).toBeNull()
    expect(acceleratorFromKeys(keys('KeyA', { shiftKey: true }))).toBeNull()
    expect(acceleratorFromKeys(keys('ShiftLeft', { ctrlKey: true }))).toBeNull()
    expect(acceleratorFromKeys(keys('IntlBackslash', { ctrlKey: true }))).toBeNull()
  })
})

describe('formatAccelerator', () => {
  it('okunabilir hale getirir', () => {
    expect(formatAccelerator('CommandOrControl+Shift+Space')).toBe('Ctrl + Shift + Space')
    expect(formatAccelerator('Super+Alt+K')).toBe('Win + Alt + K')
    expect(formatAccelerator('')).toBe('Kapalı')
  })
})
