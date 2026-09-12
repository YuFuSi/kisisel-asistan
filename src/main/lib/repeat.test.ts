import { describe, expect, it } from 'vitest'
import { nextReminderTime, parseRepeatInput, resolveReminderTime } from './repeat'

// 11 Eylül 2026 Cuma, saat 09:00
const cuma = new Date(2026, 8, 11, 9, 0).getTime()
const at = (time: number | null): string =>
  time === null ? 'yok' : new Date(time).toLocaleString('tr-TR')

describe('nextReminderTime', () => {
  it('tek seferlik hatırlatma tekrarlamaz', () => {
    expect(nextReminderTime(cuma, 'none', cuma)).toBeNull()
  })

  it('günlük: ertesi güne aynı saate atar', () => {
    const next = nextReminderTime(cuma, 'daily', cuma)
    expect(at(next)).toBe(at(new Date(2026, 8, 12, 9, 0).getTime()))
  })

  it('haftalık: 7 gün sonrasına atar', () => {
    const next = nextReminderTime(cuma, 'weekly', cuma)
    expect(at(next)).toBe(at(new Date(2026, 8, 18, 9, 0).getTime()))
  })

  it('hafta içi: cumadan pazartesiye atlar', () => {
    const next = nextReminderTime(cuma, 'weekdays', cuma)
    expect(at(next)).toBe(at(new Date(2026, 8, 14, 9, 0).getTime()))
  })

  it('uygulama kapalıyken kaçan tekrarları atlar', () => {
    // Üç gün sonra açılmış: bir sonraki tekrar bugünden sonrası olmalı
    const now = new Date(2026, 8, 14, 12, 0).getTime()
    const next = nextReminderTime(cuma, 'daily', now)
    expect(at(next)).toBe(at(new Date(2026, 8, 15, 9, 0).getTime()))
  })

  it('sonuç her zaman şimdiden sonradır', () => {
    const now = Date.now()
    for (const repeat of ['daily', 'weekdays', 'weekly'] as const) {
      const next = nextReminderTime(cuma, repeat, now)
      expect(next).not.toBeNull()
      expect(next!).toBeGreaterThan(now)
    }
  })
})

describe('resolveReminderTime', () => {
  // 11 Eylül 2026 Cuma
  const sabah8 = new Date(2026, 8, 11, 8, 0).getTime()
  const sabah10 = new Date(2026, 8, 11, 10, 0).getTime()

  it('tam tarih-saati olduğu gibi okur', () => {
    expect(at(resolveReminderTime('2026-09-20T07:30', 'none', sabah8)?.getTime() ?? null)).toBe(
      at(new Date(2026, 8, 20, 7, 30).getTime())
    )
  })

  it('saat henüz gelmediyse bugünü kullanır', () => {
    expect(at(resolveReminderTime('09:00', 'daily', sabah8)?.getTime() ?? null)).toBe(
      at(new Date(2026, 8, 11, 9, 0).getTime())
    )
  })

  it('saat geçtiyse ertesi güne atar', () => {
    expect(at(resolveReminderTime('09:00', 'daily', sabah10)?.getTime() ?? null)).toBe(
      at(new Date(2026, 8, 12, 9, 0).getTime())
    )
  })

  it('hafta içi kuralında cumartesiyi atlayıp pazartesiye atar', () => {
    expect(at(resolveReminderTime('09:00', 'weekdays', sabah10)?.getTime() ?? null)).toBe(
      at(new Date(2026, 8, 14, 9, 0).getTime())
    )
  })

  it('anlaşılmayan zamanda null döner', () => {
    expect(resolveReminderTime('yarın sabah', 'daily', sabah8)).toBeNull()
  })
})

describe('parseRepeatInput', () => {
  it('Türkçe ve İngilizce yazımları kabul eder', () => {
    expect(parseRepeatInput('her_gun')).toBe('daily')
    expect(parseRepeatInput('Her gün')).toBe('daily')
    expect(parseRepeatInput('daily')).toBe('daily')
    expect(parseRepeatInput('Hafta_İçi')).toBe('weekdays')
    expect(parseRepeatInput('hafta içi')).toBe('weekdays')
    expect(parseRepeatInput('her_hafta')).toBe('weekly')
    expect(parseRepeatInput('haftalık')).toBe('weekly')
  })

  it('boş değer tek seferliktir', () => {
    expect(parseRepeatInput(undefined)).toBe('none')
    expect(parseRepeatInput('')).toBe('none')
  })

  it('anlaşılmayan değerde hata verir', () => {
    expect(() => parseRepeatInput('ayda bir')).toThrow('anlaşılamadı')
  })
})
