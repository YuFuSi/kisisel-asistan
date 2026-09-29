import { describe, expect, it } from 'vitest'
import { isQuietTime } from './quietHours'

const at = (h: number, m = 0): Date => new Date(2026, 8, 29, h, m)

describe('isQuietTime', () => {
  it('gece yarısını aşan aralığı doğru işler (22:00-08:00)', () => {
    expect(isQuietTime(at(22), '22:00', '08:00')).toBe(true)
    expect(isQuietTime(at(3, 30), '22:00', '08:00')).toBe(true)
    expect(isQuietTime(at(7, 59), '22:00', '08:00')).toBe(true)
    expect(isQuietTime(at(8), '22:00', '08:00')).toBe(false)
    expect(isQuietTime(at(21, 59), '22:00', '08:00')).toBe(false)
  })

  it('gün içi aralığı doğru işler (13:00-14:00)', () => {
    expect(isQuietTime(at(13, 30), '13:00', '14:00')).toBe(true)
    expect(isQuietTime(at(14), '13:00', '14:00')).toBe(false)
    expect(isQuietTime(at(12, 59), '13:00', '14:00')).toBe(false)
  })

  it('aynı veya geçersiz saatlerde sessiz saat yok', () => {
    expect(isQuietTime(at(3), '08:00', '08:00')).toBe(false)
    expect(isQuietTime(at(3), 'saçma', '08:00')).toBe(false)
  })
})
