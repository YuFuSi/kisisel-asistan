import { describe, expect, it } from 'vitest'
import { baseHue, orbHsl, STATE_HUE_BIAS } from './orbColor'

describe('baseHue', () => {
  it('döngü başında maviye yakın bir değer döner', () => {
    expect(baseHue(0)).toBeCloseTo(205, 0)
  })

  it('t=1 ile t=0 aynı noktaya döner (döngüsel)', () => {
    expect(baseHue(1)).toBeCloseTo(baseHue(0), 0)
  })

  it('ara bir noktada mor bandına düşer', () => {
    const hue = baseHue(0.2)
    expect(hue).toBeGreaterThan(205)
    expect(hue).toBeLessThan(300)
  })

  it('0-1 dışındaki değerleri de döngüsel olarak sarar', () => {
    expect(baseHue(1.2)).toBeCloseTo(baseHue(0.2), 0)
    expect(baseHue(-0.2)).toBeCloseTo(baseHue(0.8), 0)
  })
})

describe('orbHsl', () => {
  it('idle durumunda ek sapma olmadan hsl string üretir', () => {
    expect(orbHsl(0, 'idle', 90, 55)).toBe(`hsl(${baseHue(0)}, 90%, 55%)`)
  })

  it('thinking durumunda hue sıcak tarafa kayar', () => {
    const idleHue = Number(orbHsl(0, 'idle', 90, 55).match(/hsl\((.+?),/)![1])
    const thinkingHue = Number(orbHsl(0, 'thinking', 90, 55).match(/hsl\((.+?),/)![1])
    expect(thinkingHue).toBe((idleHue + STATE_HUE_BIAS.thinking + 360) % 360)
  })

  it('360 ı aşan kayma 0-359 arasına sarılır', () => {
    const hue = Number(orbHsl(0.5, 'thinking', 90, 55).match(/hsl\((.+?),/)![1])
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })
})
