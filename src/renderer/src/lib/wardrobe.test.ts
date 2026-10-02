import { describe, expect, it } from 'vitest'
import { countOpening, evaluateUnlocks, type DayCounters, type WardrobeStats } from './wardrobe'

const counters = (patch: Partial<DayCounters> = {}): DayCounters => ({
  streak: 0,
  lastDay: '',
  nights: 0,
  lastNight: '',
  mornings: 0,
  lastMorning: '',
  ...patch
})

const stats = (patch: Partial<WardrobeStats> = {}): WardrobeStats => ({
  streak: 0,
  nights: 0,
  mornings: 0,
  interactions: 0,
  firstSeen: new Date(2026, 9, 1).getTime(),
  ...patch
})

describe('countOpening', () => {
  it('üst üste günleri sayar, aynı gün tekrar saymaz', () => {
    const day1 = countOpening(counters(), new Date(2026, 9, 1, 12))
    expect(day1.streak).toBe(1)
    expect(countOpening(day1, new Date(2026, 9, 1, 18)).streak).toBe(1)
    const day2 = countOpening(day1, new Date(2026, 9, 2, 10))
    expect(day2.streak).toBe(2)
  })

  it('bir gün atlanınca seri baştan başlar', () => {
    const day1 = countOpening(counters(), new Date(2026, 9, 1, 12))
    expect(countOpening(day1, new Date(2026, 9, 3, 12)).streak).toBe(1)
  })

  it('ay sonundan ay başına geçişte seri devam eder', () => {
    const last = countOpening(counters(), new Date(2026, 8, 30, 12))
    expect(countOpening(last, new Date(2026, 9, 1, 12)).streak).toBe(2)
  })

  it('gece ve sabah açılışlarını günde bir kez sayar', () => {
    const night = countOpening(counters(), new Date(2026, 9, 1, 1))
    expect(night.nights).toBe(1)
    expect(countOpening(night, new Date(2026, 9, 1, 3)).nights).toBe(1)
    const morning = countOpening(counters(), new Date(2026, 9, 1, 8))
    expect(morning.mornings).toBe(1)
    expect(countOpening(counters(), new Date(2026, 9, 1, 10)).mornings).toBe(0)
  })
})

describe('evaluateUnlocks', () => {
  const october = new Date(2026, 9, 5)

  it('baştan açık olanlar hep açık', () => {
    expect(evaluateUnlocks(stats(), october)).toEqual(['halo', 'headphones', 'bowtie', 'bracelet'])
  })

  it('seri ve etkileşimle yenileri açılır', () => {
    const open = evaluateUnlocks(stats({ streak: 7, interactions: 300 }), october)
    expect(open).toContain('focusGlasses')
    expect(open).toContain('beanie')
    expect(open).toContain('crown')
    expect(open).not.toContain('tie')
  })

  it('özel günler sadece zamanında açılır', () => {
    expect(evaluateUnlocks(stats(), new Date(2026, 11, 20))).toContain('winterHat')
    expect(evaluateUnlocks(stats(), new Date(2027, 1, 14))).toContain('heartTip')
    expect(evaluateUnlocks(stats(), october)).not.toContain('winterHat')
  })

  it('bir kez kazanılan kaybolmaz', () => {
    expect(evaluateUnlocks(stats(), october, ['winterHat'])).toContain('winterHat')
  })
})
