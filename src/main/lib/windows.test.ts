import { describe, expect, it } from 'vitest'
import { isValidWindowId } from './windows'

describe('isValidWindowId', () => {
  it('pozitif tam sayıyı kabul eder', () => {
    expect(isValidWindowId(1234)).toBe(true)
  })

  it('sıfır, negatif ve ondalık değerleri reddeder', () => {
    expect(isValidWindowId(0)).toBe(false)
    expect(isValidWindowId(-5)).toBe(false)
    expect(isValidWindowId(1.5)).toBe(false)
  })

  it('NaN ve sonsuzu reddeder', () => {
    expect(isValidWindowId(NaN)).toBe(false)
    expect(isValidWindowId(Infinity)).toBe(false)
  })
})
