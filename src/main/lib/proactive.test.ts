import { describe, expect, it } from 'vitest'
import { findStaleTasks, isProactiveNudgeDue, staleTaskNotificationText } from './proactive'
import type { Task } from '../../shared/api'

const DAY_MS = 24 * 60 * 60 * 1000

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Görev',
    notes: '',
    dueDate: null,
    dueTime: null,
    doneAt: null,
    createdAt: '2026-09-10 08:00:00',
    ...overrides
  }
}

describe('findStaleTasks', () => {
  it('3 günden yeni görevleri saymaz', () => {
    const now = new Date('2026-09-12T08:00:00Z')
    expect(findStaleTasks([task({ createdAt: '2026-09-10 08:00:00' })], now)).toBeNull()
  })

  it('tam olarak 3 gün önce oluşturulan görevi eski sayar', () => {
    const now = new Date('2026-09-13T08:00:00Z')
    const stale = task({ id: 5, createdAt: '2026-09-10 08:00:00' })
    expect(findStaleTasks([stale], now)).toEqual({ count: 1, oldest: stale })
  })

  it('tamamlanan görevleri yok sayar', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const done = task({ createdAt: '2026-09-01 08:00:00', doneAt: '2026-09-05 08:00:00' })
    expect(findStaleTasks([done], now)).toBeNull()
  })

  it('birden fazla eski görev varsa en eskisini ve sayıyı döner', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const yeni = task({ id: 1, createdAt: '2026-09-19 08:00:00' })
    const orta = task({ id: 2, createdAt: '2026-09-14 08:00:00' })
    const enEski = task({ id: 3, createdAt: '2026-09-01 08:00:00' })
    expect(findStaleTasks([yeni, orta, enEski], now)).toEqual({ count: 2, oldest: enEski })
  })

  it('özel eşik (staleMs) verilirse onu kullanır', () => {
    const now = new Date('2026-09-11T08:00:00Z')
    const t = task({ createdAt: '2026-09-10 08:00:00' })
    expect(findStaleTasks([t], now, DAY_MS)).toEqual({ count: 1, oldest: t })
  })
})

describe('staleTaskNotificationText', () => {
  it('tek görevde başlığı tekil cümlede kullanır', () => {
    const info = { count: 1, oldest: task({ title: 'Faturayı öde' }) }
    expect(staleTaskNotificationText(info).body).toContain('"Faturayı öde"')
    expect(staleTaskNotificationText(info).body).not.toContain('dahil')
  })

  it('birden fazla görevde sayıyı ve "dahil" ifadesini ekler', () => {
    const info = { count: 3, oldest: task({ title: 'Faturayı öde' }) }
    expect(staleTaskNotificationText(info).body).toContain('3 görev')
    expect(staleTaskNotificationText(info).body).toContain('dahil')
  })
})

describe('isProactiveNudgeDue', () => {
  it('bugün hiç gösterilmediyse doğru döner', () => {
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), null)).toBe(true)
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), '2026-09-15')).toBe(true)
  })

  it('bugün zaten gösterildiyse yanlış döner', () => {
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), '2026-09-16')).toBe(false)
  })
})
