import { describe, expect, it } from 'vitest'
import { toCalendarItem } from './calendar'

describe('toCalendarItem', () => {
  it('saatli etkinliği epoch zamana çevirir', () => {
    expect(
      toCalendarItem({
        id: 'a',
        summary: 'Toplantı',
        location: 'Ofis',
        start: { dateTime: '2026-09-14T10:00:00+03:00' },
        end: { dateTime: '2026-09-14T11:00:00+03:00' }
      })
    ).toEqual({
      id: 'a',
      title: 'Toplantı',
      start: Date.parse('2026-09-14T07:00:00Z'),
      end: Date.parse('2026-09-14T08:00:00Z'),
      allDay: false,
      location: 'Ofis'
    })
  })

  it('tüm gün etkinliğini yerel gün başına çevirir, başlıksızı adlandırır', () => {
    expect(
      toCalendarItem({ id: 'b', start: { date: '2026-09-14' }, end: { date: '2026-09-15' } })
    ).toEqual({
      id: 'b',
      title: '(başlıksız)',
      start: new Date(2026, 8, 14).getTime(),
      end: new Date(2026, 8, 15).getTime(),
      allDay: true,
      location: null
    })
  })

  it('başlangıcı olmayan kaydı atlar', () => {
    expect(toCalendarItem({ id: 'c' })).toBeNull()
  })
})
