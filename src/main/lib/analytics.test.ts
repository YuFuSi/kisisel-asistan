import { describe, expect, it } from 'vitest'
import type { ActivityEntry } from '../../shared/api'
import { computeUsageStats } from './analytics'

function entry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 1,
    createdAt: Date.now(),
    source: 'chat',
    kind: 'tool',
    name: 'gorev_ekle',
    label: 'Görev ekleme',
    summary: '',
    detail: '',
    status: 'done',
    approval: 'auto',
    conversationId: null,
    ...over
  }
}

const now = new Date('2026-09-22T12:00:00')
const DAY_MS = 86_400_000

describe('computeUsageStats', () => {
  it('boş listede sıfırlanmış istatistik döner', () => {
    const stats = computeUsageStats([], now)
    expect(stats.totalCalls).toBe(0)
    expect(stats.activeDayStreak).toBe(0)
    expect(stats.last14Days).toHaveLength(14)
    expect(stats.last14Days.every((d) => d.count === 0)).toBe(true)
  })

  it('durumlara göre sayar', () => {
    const stats = computeUsageStats(
      [
        entry({ status: 'done' }),
        entry({ status: 'error' }),
        entry({ status: 'denied' }),
        entry({ status: 'skipped' })
      ],
      now
    )
    expect(stats.totalCalls).toBe(4)
    expect(stats.doneCalls).toBe(1)
    expect(stats.errorCalls).toBe(1)
    expect(stats.blockedCalls).toBe(2)
  })

  it('kaynağa göre ses ve otomasyon çağrılarını sayar', () => {
    const stats = computeUsageStats(
      [entry({ source: 'voice' }), entry({ source: 'automation' }), entry({ source: 'chat' })],
      now
    )
    expect(stats.voiceCalls).toBe(1)
    expect(stats.automationCalls).toBe(1)
  })

  it('en çok kullanılan araçları çoktan aza sıralar', () => {
    const stats = computeUsageStats(
      [
        entry({ name: 'a', label: 'A' }),
        entry({ name: 'a', label: 'A' }),
        entry({ name: 'b', label: 'B' })
      ],
      now
    )
    expect(stats.topTools[0]).toEqual({ name: 'a', label: 'A', count: 2 })
    expect(stats.distinctTools).toBe(2)
  })

  it('bugünü sayarak art arda kullanılan gün serisini hesaplar', () => {
    const stats = computeUsageStats(
      [
        entry({ createdAt: now.getTime() }),
        entry({ createdAt: now.getTime() - DAY_MS }),
        entry({ createdAt: now.getTime() - 2 * DAY_MS })
      ],
      now
    )
    expect(stats.activeDayStreak).toBe(3)
  })

  it('aradaki boş gün seriyi keser', () => {
    const stats = computeUsageStats(
      [entry({ createdAt: now.getTime() }), entry({ createdAt: now.getTime() - 2 * DAY_MS })],
      now
    )
    expect(stats.activeDayStreak).toBe(1)
  })

  it('son 14 günde bugünkü kayıt son güne yazılır', () => {
    const stats = computeUsageStats([entry({ createdAt: now.getTime() })], now)
    expect(stats.last14Days.at(-1)).toEqual({ date: '2026-09-22', count: 1 })
  })
})
