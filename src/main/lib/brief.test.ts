import { describe, expect, it } from 'vitest'
import { briefNotificationText, isBriefDue, parseClockTime } from './brief'

describe('parseClockTime', () => {
  it('geçerli saati dakikaya çevirir', () => {
    expect(parseClockTime('08:30')).toBe(510)
    expect(parseClockTime('7:05')).toBe(425)
  })

  it('geçersiz saatte null döner', () => {
    expect(parseClockTime('24:00')).toBeNull()
    expect(parseClockTime('08:60')).toBeNull()
    expect(parseClockTime('sabah')).toBeNull()
  })
})

describe('isBriefDue', () => {
  const sabah = new Date(2026, 8, 12, 8, 15)

  it('saat geldiyse ve bugün gösterilmediyse gösterilir', () => {
    expect(isBriefDue(sabah, '08:00', null)).toBe(true)
    expect(isBriefDue(sabah, '08:00', '2026-09-11')).toBe(true)
  })

  it('saat gelmediyse gösterilmez', () => {
    expect(isBriefDue(sabah, '09:00', null)).toBe(false)
  })

  it('bugün zaten gösterildiyse tekrar gösterilmez', () => {
    expect(isBriefDue(sabah, '08:00', '2026-09-12')).toBe(false)
  })

  it('geçersiz saat ayarında gösterilmez', () => {
    expect(isBriefDue(sabah, '', null)).toBe(false)
  })
})

describe('briefNotificationText', () => {
  it('bilinen bilgileri sıralar', () => {
    expect(briefNotificationText({ tasks: 3, events: 2, unreadMails: 5, temperature: 21.6 })).toBe(
      '3 görev · 2 etkinlik · 5 okunmamış e-posta · 22°C. Ayrıntılı özet için tıkla.'
    )
  })

  it('Google bağlı değilse o kısımları atlar', () => {
    expect(
      briefNotificationText({ tasks: 0, events: null, unreadMails: null, temperature: null })
    ).toBe('Bekleyen görev yok. Ayrıntılı özet için tıkla.')
  })
})
