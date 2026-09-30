import { describe, expect, it } from 'vitest'
import type { UsageStats } from './analytics'
import { computeAchievements } from './achievements'

function stats(over: Partial<UsageStats> = {}): UsageStats {
  return {
    totalCalls: 0,
    doneCalls: 0,
    errorCalls: 0,
    blockedCalls: 0,
    deniedCalls: 0,
    timeoutCalls: 0,
    skippedCalls: 0,
    topTools: [],
    last14Days: [],
    activeDayStreak: 0,
    voiceCalls: 0,
    automationCalls: 0,
    distinctTools: 0,
    ...over
  }
}

describe('computeAchievements', () => {
  it('hiçbir şey yapılmamışken sadece kazanılmamış rozetler döner', () => {
    const achievements = computeAchievements(stats())
    expect(achievements.every((a) => !a.achieved)).toBe(true)
    expect(achievements).toHaveLength(7)
  })

  it('eşiği geçince ilgili rozeti kazanılmış işaretler', () => {
    const achievements = computeAchievements(stats({ totalCalls: 1 }))
    const firstStep = achievements.find((a) => a.id === 'first-step')
    expect(firstStep?.achieved).toBe(true)
  })

  it('kazanılanları önce, kazanılmamışları ilerlemeye göre sıralar', () => {
    const achievements = computeAchievements(
      stats({ totalCalls: 1, activeDayStreak: 2, voiceCalls: 0 })
    )
    expect(achievements[0].achieved).toBe(true)
    const achievedCount = achievements.filter((a) => a.achieved).length
    // Kazanılmamışlar arasında streak-3 (2/3), voice-user (0/1)'den önce gelmeli
    const order = achievements.slice(achievedCount).map((a) => a.id)
    expect(order.indexOf('streak-3')).toBeLessThan(order.indexOf('voice-user'))
  })

  it('100 çağrıda "100. komut" rozetini verir', () => {
    const achievements = computeAchievements(stats({ totalCalls: 100 }))
    expect(achievements.find((a) => a.id === 'hundred-calls')?.achieved).toBe(true)
  })

  it('8 farklı araçta "çok yönlü" rozetini verir', () => {
    const achievements = computeAchievements(stats({ distinctTools: 8 }))
    expect(achievements.find((a) => a.id === 'versatile')?.achieved).toBe(true)
  })
})
