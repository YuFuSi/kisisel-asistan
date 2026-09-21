import { describe, expect, it } from 'vitest'
import type { Reminder, Task } from '@shared/api'
import { buildHomeSummary } from './homeSummary'

// 2026-09-21 Pazartesi 10:00 (yerel)
const now = new Date(2026, 8, 21, 10, 0)

function task(partial: Partial<Task>): Task {
  return {
    id: 1,
    title: 'Görev',
    notes: '',
    dueDate: null,
    dueTime: null,
    doneAt: null,
    createdAt: '2026-09-20 09:00:00',
    ...partial
  }
}

function reminder(partial: Partial<Reminder>): Reminder {
  return { id: 1, message: 'Hatırlatma', remindAt: 0, sentAt: null, repeat: 'none', ...partial }
}

describe('buildHomeSummary', () => {
  it('iş yoksa sakin bir cümle döner', () => {
    expect(buildHomeSummary({ tasks: [], reminders: [], now })).toBe(
      'Bugün önünde acil bir iş yok.'
    )
  })

  it('tarihsiz görevleri saymaz', () => {
    const tasks = [task({ dueDate: null })]
    expect(buildHomeSummary({ tasks, reminders: [], now })).toBe('Bugün önünde acil bir iş yok.')
  })

  it('bugünün görevlerini sayar, tamamlananları saymaz', () => {
    const tasks = [
      task({ id: 1, dueDate: '2026-09-21' }),
      task({ id: 2, dueDate: '2026-09-21', doneAt: '2026-09-21 08:00:00' })
    ]
    expect(buildHomeSummary({ tasks, reminders: [], now })).toBe('Bugün 1 görevin var.')
  })

  it('geciken görevi ayrıca belirtir', () => {
    const tasks = [task({ id: 1, dueDate: '2026-09-20' }), task({ id: 2, dueDate: '2026-09-21' })]
    expect(buildHomeSummary({ tasks, reminders: [], now })).toBe(
      'Bugün 2 görevin var. 1 tanesi gecikti.'
    )
  })

  it('bugünün henüz çalmamış hatırlatmalarını sayar', () => {
    const reminders = [
      reminder({ id: 1, message: 'Su iç', remindAt: new Date(2026, 8, 21, 12, 30).getTime() }),
      reminder({ id: 2, remindAt: new Date(2026, 8, 21, 9, 0).getTime() }),
      reminder({ id: 3, remindAt: new Date(2026, 8, 22, 9, 0).getTime() })
    ]
    expect(buildHomeSummary({ tasks: [], reminders, now })).toBe(
      'Bugün 1 hatırlatman var. Sıradaki: 12:30 Su iç.'
    )
  })

  it('görev ve hatırlatmayı birlikte, en yakın saatliyi sıradaki olarak verir', () => {
    const tasks = [task({ dueDate: '2026-09-21', dueTime: '14:00', title: 'Toplantı' })]
    const reminders = [
      reminder({ message: 'Su iç', remindAt: new Date(2026, 8, 21, 11, 15).getTime() })
    ]
    expect(buildHomeSummary({ tasks, reminders, now })).toBe(
      'Bugün 1 görevin ve 1 hatırlatman var. Sıradaki: 11:15 Su iç.'
    )
  })

  it('saati geçmiş görevi sıradaki olarak göstermez', () => {
    const tasks = [task({ dueDate: '2026-09-21', dueTime: '08:00', title: 'Sabah işi' })]
    expect(buildHomeSummary({ tasks, reminders: [], now })).toBe('Bugün 1 görevin var.')
  })
})
