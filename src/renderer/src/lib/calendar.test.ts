import { describe, expect, it } from 'vitest'
import { buildAgenda, gridRange, monthGrid } from './calendar'
import type { CalendarItem, Reminder, Task } from '../../../shared/api'

const at = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

describe('monthGrid', () => {
  it('Eylül 2026 ızgarası pazartesi 31 Ağustos ile başlar', () => {
    const cells = monthGrid(2026, 8, new Date(2026, 8, 14))
    expect(cells).toHaveLength(42)
    expect(cells[0]).toEqual({ iso: '2026-08-31', day: 31, inMonth: false, today: false })
    expect(cells[1]).toMatchObject({ iso: '2026-09-01', inMonth: true })
    expect(cells.filter((cell) => cell.today).map((cell) => cell.iso)).toEqual(['2026-09-14'])
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(30)
  })

  it('ay pazartesi başlıyorsa önceki aydan gün eklemez', () => {
    // 1 Haziran 2026 pazartesi
    const cells = monthGrid(2026, 5, new Date(2026, 0, 1))
    expect(cells[0].iso).toBe('2026-06-01')
    expect(gridRange(cells)).toEqual({
      from: new Date(2026, 5, 1),
      to: new Date(2026, 6, 13)
    })
  })
})

describe('buildAgenda', () => {
  const events: CalendarItem[] = [
    {
      id: 'toplanti',
      title: 'Toplantı',
      start: at(2026, 9, 14, 10),
      end: at(2026, 9, 14, 11),
      allDay: false,
      location: 'Ofis'
    },
    {
      id: 'tatil',
      title: 'Tatil',
      start: at(2026, 9, 13),
      // Tüm gün etkinliklerde bitiş günü hariçtir: 13-14 Eylül
      end: at(2026, 9, 15),
      allDay: true,
      location: null
    }
  ]
  const reminders: Reminder[] = [
    { id: 1, message: 'Vitamin', remindAt: at(2026, 9, 14, 9), sentAt: null, repeat: 'daily' },
    { id: 2, message: 'Yarın', remindAt: at(2026, 9, 15, 9), sentAt: null, repeat: 'none' }
  ]
  const tasks: Task[] = [
    {
      id: 5,
      title: 'Fatura öde',
      notes: '',
      dueDate: '2026-09-14',
      dueTime: null,
      doneAt: '2026-09-14T08:00:00Z',
      createdAt: ''
    },
    {
      id: 6,
      title: 'Tarihsiz',
      notes: '',
      dueDate: null,
      dueTime: null,
      doneAt: null,
      createdAt: ''
    },
    {
      id: 7,
      title: 'Toplantı hazırlığı',
      notes: '',
      dueDate: '2026-09-14',
      dueTime: '09:30',
      doneAt: null,
      createdAt: ''
    }
  ]

  it('günün kayıtlarını tüm gün/görevler önce, sonra saat sırasıyla verir', () => {
    const agenda = buildAgenda('2026-09-14', events, reminders, tasks)
    expect(agenda.map((entry) => entry.title)).toEqual([
      'Tatil',
      'Fatura öde',
      'Vitamin',
      'Toplantı hazırlığı',
      'Toplantı'
    ])
    expect(agenda.find((entry) => entry.kind === 'reminder')?.detail).toBe('Her gün')
    expect(agenda.find((entry) => entry.title === 'Fatura öde')).toMatchObject({
      taskId: 5,
      time: null,
      done: true
    })
  })

  it('saatli görevin epoch zamanını hesaplar ve saate göre sıralar', () => {
    const agenda = buildAgenda('2026-09-14', [], [], tasks)
    const toplanti = agenda.find((entry) => entry.title === 'Toplantı hazırlığı')
    expect(toplanti).toMatchObject({ taskId: 7, time: at(2026, 9, 14, 9, 30), done: false })
  })

  it('birden çok güne yayılan tüm gün etkinliği bitiş gününe taşmaz', () => {
    expect(buildAgenda('2026-09-13', events, [], []).map((entry) => entry.title)).toEqual(['Tatil'])
    expect(buildAgenda('2026-09-15', events, reminders, tasks).map((entry) => entry.title)).toEqual(
      ['Yarın']
    )
  })
})
