import { describe, expect, it } from 'vitest'
import { cosineSimilarity } from './cosine'

describe('cosineSimilarity', () => {
  it('aynı vektörlerde 1 döner', () => {
    const a = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
  })

  it('dik (ortogonal) vektörlerde 0 döner', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('zıt vektörlerde -1 döner', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([-1, -2, -3])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('sıfır vektöründe NaN/Infinity yerine 0 döner', () => {
    const zero = new Float32Array([0, 0, 0])
    const a = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(zero, a)).toBe(0)
    expect(cosineSimilarity(zero, zero)).toBe(0)
  })

  it('farklı uzunluktaki vektörlerde ortak kısmı kullanır, çökmez', () => {
    const a = new Float32Array([1, 1, 1, 1])
    const b = new Float32Array([1, 1])
    expect(() => cosineSimilarity(a, b)).not.toThrow()
  })
})
