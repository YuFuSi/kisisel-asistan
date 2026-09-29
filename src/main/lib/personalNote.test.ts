import { describe, expect, it } from 'vitest'
import { buildPersonalNotePrompt, cleanPersonalNote, type PersonalContext } from './personalNote'

const context: PersonalContext = {
  profile: ['Kullanıcının adı Yusuf.'],
  upcoming: [{ content: 'Kullanıcı köpeği Pamuk’u Salı aşıya götürecek.', learnedAt: '28 Eylül' }],
  tasks: [{ title: 'Faturayı öde', time: null, overdue: true }],
  reminders: [{ message: 'İlaç', time: '21:00' }],
  events: [{ title: 'Toplantı', time: '14:00' }]
}

describe('buildPersonalNotePrompt', () => {
  it('hafızayı, planları, takvimi, görevleri ve hatırlatmaları verir', () => {
    const { prompt } = buildPersonalNotePrompt(context, 'home', new Date(2026, 8, 29, 9, 5))
    expect(prompt).toContain('29 Eylül 2026 Salı, saat 09:05')
    expect(prompt).toContain('- Kullanıcının adı Yusuf.')
    expect(prompt).toContain('- [28 Eylül] Kullanıcı köpeği Pamuk’u Salı aşıya götürecek.')
    expect(prompt).toContain('- 14:00 Toplantı')
    expect(prompt).toContain('- Faturayı öde [gecikmiş]')
    expect(prompt).toContain('- 21:00 İlaç')
  })

  it('takvim bağlı değilse ve boşsa bunu açıkça söyler', () => {
    const { prompt } = buildPersonalNotePrompt(
      { profile: [], upcoming: [], tasks: [], reminders: [], events: null },
      'brief',
      new Date(2026, 8, 29, 8)
    )
    expect(prompt).toContain('(bilinmiyor)')
    expect(prompt).toContain('(takvim bağlı değil)')
  })

  it('türe göre talimat değişir', () => {
    const now = new Date(2026, 8, 29, 8)
    expect(buildPersonalNotePrompt(context, 'home', now).instructions).toContain('ana ekranında')
    expect(buildPersonalNotePrompt(context, 'brief', now).instructions).toContain('sesli okunacak')
  })
})

describe('cleanPersonalNote', () => {
  it('düşünme bloğunu, tırnak ve markdown işaretlerini atar', () => {
    expect(cleanPersonalNote('<think>x</think>"**Yusuf**, bugün 14:00’te toplantın var."')).toBe(
      'Yusuf, bugün 14:00’te toplantın var.'
    )
  })

  it('baştaki selamlaşmayı atar (başlıktaki saate uygun selamla çelişmesin)', () => {
    expect(cleanPersonalNote('Günaydın Yusuf, bugün iş ilanı planın var.')).toBe(
      'Yusuf, bugün iş ilanı planın var.'
    )
    expect(cleanPersonalNote('İyi akşamlar! Yarın 14:00’te toplantın var.')).toBe(
      'Yarın 14:00’te toplantın var.'
    )
    expect(cleanPersonalNote('Selam Yusuf, bugün sakin bir gün.')).toBe(
      'Yusuf, bugün sakin bir gün.'
    )
  })

  it('boş veya çok kısa cevapta null döner, uzunu kısaltır', () => {
    expect(cleanPersonalNote('<think>uzun düşünce</think>')).toBeNull()
    expect(cleanPersonalNote('Tamam')).toBeNull()
    expect(cleanPersonalNote('a'.repeat(400))).toHaveLength(280)
  })
})
