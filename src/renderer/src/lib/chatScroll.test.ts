import { describe, expect, it } from 'vitest'
import { isNearScrollEnd } from './chatScroll'

describe('sohbet kaydırma takibi', () => {
  it('sona yakınken ve taşmayan içerikte takip eder', () => {
    expect(isNearScrollEnd({ scrollHeight: 1000, scrollTop: 420, clientHeight: 500 })).toBe(true)
    expect(isNearScrollEnd({ scrollHeight: 300, scrollTop: 0, clientHeight: 500 })).toBe(true)
  })
  it('geçmişi okuyan kullanıcıyı aşağı çekmez', () => {
    expect(isNearScrollEnd({ scrollHeight: 1000, scrollTop: 200, clientHeight: 500 })).toBe(false)
  })
})
