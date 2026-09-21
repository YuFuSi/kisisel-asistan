import { describe, expect, it } from 'vitest'
import { binSpectrum } from './audioLevel'

describe('binSpectrum', () => {
  it('veriyi istenen bant sayısına böler', () => {
    const data = new Uint8Array(256).fill(0)
    const result = binSpectrum(data, 8)
    expect(result).toHaveLength(8)
  })

  it('sıfır veri için tüm bantlar 0 döner', () => {
    const data = new Uint8Array(256).fill(0)
    expect(binSpectrum(data, 4)).toEqual([0, 0, 0, 0])
  })

  it('255 dolu veri için tüm bantlar 1 döner', () => {
    const data = new Uint8Array(256).fill(255)
    expect(binSpectrum(data, 4)).toEqual([1, 1, 1, 1])
  })

  it('bant sayısı veriden büyükse NaN üretmez', () => {
    const result = binSpectrum(new Uint8Array(2), 5)
    expect(result).toHaveLength(5)
    expect(result.every(Number.isFinite)).toBe(true)
  })

  it('bir bandın ortalamasını doğru hesaplar', () => {
    const data = new Uint8Array(4)
    data[0] = 0
    data[1] = 255
    const result = binSpectrum(data, 1)
    expect(result[0]).toBeCloseTo((0 + 255 + 0 + 0) / 4 / 255, 2)
  })
})
