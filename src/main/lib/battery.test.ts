import { describe, expect, it } from 'vitest'
import { shouldResetLowBatteryWarning, shouldWarnLowBattery, type BatteryReading } from './battery'

function reading(overrides: Partial<BatteryReading> = {}): BatteryReading {
  return { hasBattery: true, acConnected: false, percent: 15, ...overrides }
}

describe('shouldWarnLowBattery', () => {
  it('pil düşük, kablo takılı değil ve henüz uyarılmadıysa evet döner', () => {
    expect(shouldWarnLowBattery(reading({ percent: 15 }), false)).toBe(true)
  })

  it('tam eşikte de uyarır (yüzde 20)', () => {
    expect(shouldWarnLowBattery(reading({ percent: 20 }), false)).toBe(true)
  })

  it('eşiğin üstündeyse uyarmaz', () => {
    expect(shouldWarnLowBattery(reading({ percent: 21 }), false)).toBe(false)
  })

  it('kablo takılıysa uyarmaz', () => {
    expect(shouldWarnLowBattery(reading({ percent: 5, acConnected: true }), false)).toBe(false)
  })

  it('pil yoksa (masaüstü bilgisayar) uyarmaz', () => {
    expect(shouldWarnLowBattery(reading({ hasBattery: false, percent: 5 }), false)).toBe(false)
  })

  it('zaten uyarıldıysa tekrar uyarmaz', () => {
    expect(shouldWarnLowBattery(reading({ percent: 10 }), true)).toBe(false)
  })
})

describe('shouldResetLowBatteryWarning', () => {
  it('kablo takılınca sıfırlanır', () => {
    expect(shouldResetLowBatteryWarning(reading({ percent: 10, acConnected: true }))).toBe(true)
  })

  it('pil yeterince dolunca sıfırlanır', () => {
    expect(shouldResetLowBatteryWarning(reading({ percent: 25 }))).toBe(true)
  })

  it('hâlâ düşük ve kablo takılı değilse sıfırlanmaz', () => {
    expect(shouldResetLowBatteryWarning(reading({ percent: 10 }))).toBe(false)
  })
})
