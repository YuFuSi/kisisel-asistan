import { describe, expect, it } from 'vitest'
import { orbHsla, orbHslaShift, STATE_HUE_SHIFT } from './orbColor'

function hueOf(color: string): number {
  return Number(color.match(/hsla\((\d+),/)![1])
}

describe('orbHsla', () => {
  it('idle durumunda taban vurgu tonunu kullanır', () => {
    expect(orbHsla('idle', 70, 0.5)).toBe('hsla(231, 72%, 70%, 0.5)')
  })

  it('durum tonu tabana eklenir', () => {
    expect(hueOf(orbHsla('thinking', 70))).toBe(231 + STATE_HUE_SHIFT.thinking)
    expect(hueOf(orbHsla('speaking', 70))).toBe(231 + STATE_HUE_SHIFT.speaking)
  })

  it('ton 0-359 aralığında sarılır', () => {
    const hue = hueOf(orbHsla('working', 70, 1, 200))
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })

  it('alpha verilmezse tam opaktır', () => {
    expect(orbHsla('idle', 50)).toBe('hsla(231, 72%, 50%, 1)')
  })
})

describe('orbHslaShift', () => {
  it('ara kaymalarda tabana ekleyip tonu sarar', () => {
    expect(orbHslaShift(0, 70, 1)).toBe('hsla(231, 72%, 70%, 1)')
    expect(hueOf(orbHslaShift(-20, 70))).toBe(211)
    expect(hueOf(orbHslaShift(150, 70))).toBe(21)
  })

  it('orbHsla ile aynı sonucu verir', () => {
    expect(orbHslaShift(STATE_HUE_SHIFT.thinking, 60, 0.5, 4)).toBe(orbHsla('thinking', 60, 0.5, 4))
  })
})
