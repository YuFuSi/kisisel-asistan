import { describe, expect, it } from 'vitest'
import type { CalendarItem, Reminder, Task } from '@shared/api'
import { buildTimeline, nowIndex } from './sidebarTimeline'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Görev',
    notes: '',
    dueDate: '2026-09-22',
    dueTime: null,
    doneAt: null,
    createdAt: '2026-09-22T00:00:00.000Z',
    ...over
  }
}

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 1,
    message: 'Hatırlatma',
    remindAt: new Date('2026-09-22T10:00:00').getTime(),
    sentAt: null,
    repeat: 'none',
    ...over
  }
}

function calendarEvent(over: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'e1',
    title: 'Etkinlik',
    start: new Date('2026-09-22T11:00:00').getTime(),
    end: new Date('2026-09-22T12:00:00').getTime(),
    allDay: false,
    location: null,
    ...over
  }
}

const now = new Date('2026-09-22T09:00:00')

describe('buildTimeline', () => {
  it('bugünün saatli görev ve hatırlatmalarını saate göre sıralar', () => {
    const items = buildTimeline({
      tasks: [task({ id: 1, dueTime: '14:00', title: 'Toplantı' })],
      reminders: [reminder({ id: 1, message: 'Vitamin' })],
      now
    })
    expect(items.map((i) => i.label)).toEqual(['Vitamin', 'Toplantı'])
  })

  it('başka güne ait kayıtları hariç tutar', () => {
    const items = buildTimeline({
      tasks: [task({ dueDate: '2026-09-23' })],
      reminders: [reminder({ remindAt: new Date('2026-09-23T10:00:00').getTime() })],
      now
    })
    expect(items).toHaveLength(0)
  })

  it('geçmiş saatli tamamlanmamış görevi gecikmiş sayar', () => {
    const items = buildTimeline({
      tasks: [task({ dueTime: '08:00' })],
      reminders: [],
      now
    })
    expect(items[0].overdue).toBe(true)
  })

  it('tamamlanmış görev gecikmiş sayılmaz', () => {
    const items = buildTimeline({
      tasks: [task({ dueTime: '08:00', doneAt: '2026-09-22T08:05:00.000Z' })],
      reminders: [],
      now
    })
    expect(items[0].done).toBe(true)
    expect(items[0].overdue).toBe(false)
  })

  it('bugünün takvim etkinliğini saatine göre araya ekler', () => {
    const items = buildTimeline({
      tasks: [task({ dueTime: '14:00', title: 'Toplantı' })],
      reminders: [],
      events: [calendarEvent({ title: 'Diş' })],
      now
    })
    expect(items.map((i) => i.label)).toEqual(['Diş', 'Toplantı'])
  })

  it('tüm gün etkinliğini gün başına, "(tüm gün)" etiketiyle ekler', () => {
    const items = buildTimeline({
      tasks: [],
      reminders: [],
      events: [
        calendarEvent({
          title: 'Tatil',
          allDay: true,
          start: new Date('2026-09-22T00:00:00').getTime(),
          end: null
        })
      ],
      now
    })
    expect(items[0]).toMatchObject({ time: '00:00', label: 'Tatil (tüm gün)' })
  })

  it('bitmiş etkinliği geçmiş sayar', () => {
    const items = buildTimeline({
      tasks: [],
      reminders: [],
      events: [
        calendarEvent({
          start: new Date('2026-09-22T06:00:00').getTime(),
          end: new Date('2026-09-22T07:00:00').getTime()
        })
      ],
      now
    })
    expect(items[0].done).toBe(true)
  })

  it('başka güne ait etkinliği hariç tutar', () => {
    const items = buildTimeline({
      tasks: [],
      reminders: [],
      events: [calendarEvent({ start: new Date('2026-09-23T11:00:00').getTime() })],
      now
    })
    expect(items).toHaveLength(0)
  })
})

describe('nowIndex', () => {
  it('şimdiden sonraki ilk tamamlanmamış öğeyi bulur', () => {
    const items = buildTimeline({
      tasks: [
        task({ id: 1, dueTime: '08:00', title: 'Geçti' }),
        task({ id: 2, dueTime: '14:00', title: 'Sıradaki' })
      ],
      reminders: [],
      now
    })
    expect(items[nowIndex(items, now)].label).toBe('Sıradaki')
  })

  it('hepsi geçtiyse dizi uzunluğunu döner', () => {
    const items = buildTimeline({ tasks: [task({ dueTime: '08:00' })], reminders: [], now })
    expect(nowIndex(items, now)).toBe(-1)
  })
})
