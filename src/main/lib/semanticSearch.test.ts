import { describe, expect, it } from 'vitest'
import { sortBySimilarity } from './semanticSearch'

const items = [
  { id: 1, embedding: new Float32Array([1, 0, 0]) },
  { id: 2, embedding: new Float32Array([0, 1, 0]) },
  { id: 3, embedding: new Float32Array([0.9, 0.1, 0]) },
  { id: 4, embedding: null }
]

describe('sortBySimilarity', () => {
  it('sorgu vektörüne en yakın öğeyi başa alır', () => {
    const sorted = sortBySimilarity(items, new Float32Array([1, 0, 0]))
    expect(sorted.map((i) => i.id)).toEqual([1, 3, 2, 4])
  })

  it("embedding'i eksik öğeyi dışlamaz, en sona atar", () => {
    const sorted = sortBySimilarity(items, new Float32Array([0, 1, 0]))
    expect(sorted.at(-1)?.id).toBe(4)
  })

  it('orijinal diziyi değiştirmez', () => {
    const copy = [...items]
    sortBySimilarity(items, new Float32Array([1, 0, 0]))
    expect(items).toEqual(copy)
  })
})
