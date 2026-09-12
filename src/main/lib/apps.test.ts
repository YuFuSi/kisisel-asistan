import { describe, expect, it } from 'vitest'
import { findApp, isSafeAppId, suggestApps, type StartApp } from './apps'

const apps: StartApp[] = [
  { ad: 'Not Defteri', appId: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe!App' },
  { ad: 'Word', appId: 'Word' },
  { ad: 'Word ile yeni belge', appId: 'WordNew' },
  { ad: 'Hesap Makinesi', appId: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' },
  { ad: 'Google Chrome', appId: 'Chrome' }
]

describe('findApp', () => {
  it('birebir eşleşmeyi seçer (büyük/küçük harf farkı olsa da)', () => {
    expect(findApp(apps, 'not defteri')?.appId).toContain('Notepad')
    expect(findApp(apps, 'WORD')?.appId).toBe('Word')
  })

  it('kelimelerin hepsini içeren en kısa adı seçer', () => {
    expect(findApp(apps, 'chrome')?.ad).toBe('Google Chrome')
    expect(findApp(apps, 'hesap')?.ad).toBe('Hesap Makinesi')
  })

  it('eşleşme yoksa undefined döner', () => {
    expect(findApp(apps, 'fotoşop')).toBeUndefined()
    expect(findApp(apps, '   ')).toBeUndefined()
  })
})

describe('suggestApps', () => {
  it('ilk kelimeye göre öneri verir', () => {
    expect(suggestApps(apps, 'word belgesi')).toEqual(['Word', 'Word ile yeni belge'])
    expect(suggestApps(apps, 'zzz')).toEqual([])
  })
})

describe('isSafeAppId', () => {
  it('normal kimlikleri kabul eder, tehlikeli karakterleri reddeder', () => {
    expect(isSafeAppId('Microsoft.WindowsNotepad_8wekyb3d8bbwe!App')).toBe(true)
    expect(isSafeAppId(String.raw`C:\Program Files\App\app.exe`)).toBe(true)
    expect(isSafeAppId('app & calc')).toBe(false)
    expect(isSafeAppId('app" | del')).toBe(false)
  })
})
