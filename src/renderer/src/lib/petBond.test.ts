import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bondStage, type Bond } from './petBond'

const NOW = new Date('2026-10-02T12:00:00.000Z').getTime()
const DAY = 24 * 60 * 60 * 1000

function bond(overrides: Partial<Bond> = {}): Bond {
  return {
    happiness: 70,
    firstSeen: NOW,
    lastSeen: NOW,
    interactions: 0,
    ...overrides
  }
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bondStage', () => {
  it('yeni tanışılan pet için shy döndürür', () => {
    expect(bondStage(bond())).toBe('shy')
  })

  it('40 etkileşimde friend aşamasına geçer', () => {
    expect(bondStage(bond({ interactions: 40 }))).toBe('friend')
  })

  it('7 günde friend aşamasına geçer', () => {
    expect(bondStage(bond({ firstSeen: NOW - 7 * DAY }))).toBe('friend')
  })

  it('30 günde buddy aşamasına geçer', () => {
    expect(bondStage(bond({ firstSeen: NOW - 30 * DAY }))).toBe('buddy')
  })

  it('300 etkileşimde buddy aşamasına geçer', () => {
    expect(bondStage(bond({ interactions: 300 }))).toBe('buddy')
  })
})
