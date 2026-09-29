import { describe, expect, it } from 'vitest'
import type { DailyBrief } from '../ai/brief'
import { briefNotificationText, briefSpokenText, isBriefDue, parseClockTime } from './brief'

function brief(overrides: Partial<DailyBrief> = {}): DailyBrief {
  return {
    tarih: '16 Eylül Çarşamba',
    hava: null,
    gorevler: [],
    hatirlatmalar: [],
    etkinlikler: null,
    okunmamisEposta: null,
    kisiselNot: null,
    uyarilar: [],
    ...overrides
  }
}

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

describe('briefSpokenText', () => {
  it('bilinen bilgileri doğal cümlelere çevirir', () => {
    const text = briefSpokenText(
      brief({
        hava: {
          yer: 'İstanbul',
          sicaklik: 21.6,
          durum: 'Parçalı bulutlu',
          enDusuk: 18,
          enYuksek: 24,
          yagisIhtimali: 10
        },
        gorevler: [{ baslik: 'Fatura öde', sonTarih: null, gecikmis: false }],
        etkinlikler: [{ baslik: 'Toplantı', saat: '10:00' }],
        okunmamisEposta: 3
      })
    )
    expect(text).toBe(
      'Günaydın! Bugün 16 Eylül Çarşamba. Hava 22 derece, Parçalı bulutlu. 1 bekleyen görevin var. Bugün 1 etkinliğin var. 3 okunmamış e-postan var.'
    )
  })

  it('bilgi yoksa boş/sıfır durumları doğal şekilde söyler', () => {
    const text = briefSpokenText(brief())
    expect(text).toBe('Günaydın! Bugün 16 Eylül Çarşamba. Bekleyen görevin yok.')
  })

  it('Google bağlı değilse etkinlik ve e-posta cümlelerini hiç eklemez', () => {
    const text = briefSpokenText(brief({ etkinlikler: null, okunmamisEposta: null }))
    expect(text).not.toContain('etkinlik')
    expect(text).not.toContain('e-posta')
  })

  it('kişisel not varsa tarihten hemen sonra okunur', () => {
    const text = briefSpokenText(brief({ kisiselNot: 'Yusuf, bugün Pamuk’un aşı günü.' }))
    expect(text).toBe(
      'Günaydın! Bugün 16 Eylül Çarşamba. Yusuf, bugün Pamuk’un aşı günü. Bekleyen görevin yok.'
    )
  })

  it('okunmamış e-posta sıfırsa cümleyi eklemez', () => {
    const text = briefSpokenText(brief({ okunmamisEposta: 0 }))
    expect(text).not.toContain('e-posta')
  })
})
