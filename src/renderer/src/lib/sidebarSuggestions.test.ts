import { describe, expect, it } from 'vitest'
import type { Reminder, Task } from '@shared/api'
import { buildSuggestions } from './sidebarSuggestions'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Görev',
    notes: '',
    dueDate: null,
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
    remindAt: 0,
    sentAt: null,
    repeat: 'none',
    ...over
  }
}

const now = new Date('2026-09-22T12:00:00')

describe('buildSuggestions', () => {
  it('veri temizse öneri vermez', () => {
    expect(buildSuggestions({ tasks: [], reminders: [], now })).toEqual([])
  })

  it('3+ gündür bekleyen görev için öneri verir', () => {
    const suggestions = buildSuggestions({
      tasks: [task({ dueDate: '2026-09-18', title: 'Rapor' })],
      reminders: [],
      now
    })
    expect(suggestions[0].id).toBe('stale-tasks')
    expect(suggestions[0].text).toContain('Rapor')
    expect(suggestions[0].action).toEqual({ kind: 'open-tasks' })
  })

  it('sadece dün geciken görev için ayrı, daha yumuşak öneri verir', () => {
    const suggestions = buildSuggestions({
      tasks: [task({ dueDate: '2026-09-21' })],
      reminders: [],
      now
    })
    expect(suggestions[0].id).toBe('overdue-tasks')
  })

  it('30 dk içindeki hatırlatma için öneri verir', () => {
    const suggestions = buildSuggestions({
      tasks: [],
      reminders: [reminder({ remindAt: now.getTime() + 10 * 60_000 })],
      now
    })
    expect(suggestions.some((s) => s.id === 'upcoming-reminder')).toBe(true)
  })

  it("30 dk'dan uzak hatırlatma için öneri vermez", () => {
    const suggestions = buildSuggestions({
      tasks: [],
      reminders: [reminder({ remindAt: now.getTime() + 60 * 60_000 })],
      now
    })
    expect(suggestions).toEqual([])
  })

  it('en fazla 2 öneri döner', () => {
    const suggestions = buildSuggestions({
      tasks: [task({ dueDate: '2026-09-18' })],
      reminders: [reminder({ remindAt: now.getTime() + 5 * 60_000 })],
      now
    })
    expect(suggestions.length).toBeLessThanOrEqual(2)
  })
})
