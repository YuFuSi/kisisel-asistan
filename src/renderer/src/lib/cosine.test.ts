import { describe, expect, it } from 'vitest'
import { cosineSimilarity } from './cosine'

describe('cosineSimilarity', () => {
  it('aynı vektör için 1 döner', () => {
    const v = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('dik vektörler için 0 döner', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('zıt yönlü vektörler için -1 döner', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1)
  })

  it('sıfır vektörde 0 döner (bölme hatası olmaz)', () => {
    const zero = new Float32Array([0, 0, 0])
    const v = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(zero, v)).toBe(0)
  })
})
