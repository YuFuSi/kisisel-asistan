import { describe, expect, it } from 'vitest'
import { blobToFloats, floatsToBlob } from './embeddingBlob'

describe('floatsToBlob / blobToFloats', () => {
  it('bir vektörü baytlara çevirip geri okuyunca aynı değerleri verir', () => {
    const original = new Float32Array([1.5, -2.25, 0, 3.75])
    const blob = floatsToBlob(original)
    const restored = blobToFloats(blob)
    expect(Array.from(restored)).toEqual(Array.from(original))
  })
})
