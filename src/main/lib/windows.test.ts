import { describe, expect, it } from 'vitest'
import { isValidCoordinate, isValidSize, isValidWindowId } from './windows'

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

describe('isValidCoordinate', () => {
  it('negatif ve pozitif makul konumları kabul eder (ekran dışına taşma dahil)', () => {
    expect(isValidCoordinate(0)).toBe(true)
    expect(isValidCoordinate(-100)).toBe(true)
    expect(isValidCoordinate(3000)).toBe(true)
  })

  it('ondalık ve aşırı büyük değerleri reddeder', () => {
    expect(isValidCoordinate(1.5)).toBe(false)
    expect(isValidCoordinate(50000)).toBe(false)
  })
})

describe('isValidSize', () => {
  it('makul pozitif boyutu kabul eder', () => {
    expect(isValidSize(800)).toBe(true)
  })

  it('sıfır, negatif, ondalık ve aşırı büyük değerleri reddeder', () => {
    expect(isValidSize(0)).toBe(false)
    expect(isValidSize(-1)).toBe(false)
    expect(isValidSize(1.5)).toBe(false)
    expect(isValidSize(50000)).toBe(false)
  })
})
