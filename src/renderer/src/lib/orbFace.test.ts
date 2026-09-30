import { describe, expect, it } from 'vitest'
import { blinkAmount, faceTarget, mixFace, NEUTRAL_FACE, nextBlinkDelay } from './orbFace'

describe('faceTarget', () => {
  it('duygu, durumun önüne geçer', () => {
    expect(faceTarget('working', 'success').smile).toBe(1)
    expect(faceTarget('idle', 'error').cross).toBe(1)
  })

  it('onay beklerken ünlem çıkar, boştayken çıkmaz', () => {
    expect(faceTarget('approval', null).alert).toBe(1)
    expect(faceTarget('idle', null).alert).toBe(0)
  })

  it('dinlerken gözler büyür, düşünürken yukarı bakar', () => {
    expect(faceTarget('listening', null).open).toBeGreaterThan(1)
    expect(faceTarget('thinking', null).lookY).toBeLessThan(0)
  })

  it('varsayılan yüzü değiştirilebilir kopya olarak vermez ama sabiti bozmaz', () => {
    const face = { ...faceTarget('idle', null) }
    face.lookX = 5
    expect(NEUTRAL_FACE.lookX).toBe(0)
  })
})

describe('mixFace', () => {
  it('uçlarda iki yüzü, ortada karışımı verir', () => {
    const b = faceTarget('listening', null)
    expect(mixFace(NEUTRAL_FACE, b, 0)).toEqual(NEUTRAL_FACE)
    expect(mixFace(NEUTRAL_FACE, b, 1)).toEqual(b)
    expect(mixFace(NEUTRAL_FACE, b, 0.5).open).toBeCloseTo((1 + b.open) / 2)
  })
})

describe('göz kırpma', () => {
  it('kırpma dışında gözler açık', () => {
    expect(blinkAmount(-10)).toBe(0)
    expect(blinkAmount(500)).toBe(0)
    expect(blinkAmount(70)).toBeCloseTo(1)
  })

  it('aralık 2,8-6 sn, bazen hızlı çift kırpma', () => {
    expect(nextBlinkDelay(0.1)).toBe(260)
    expect(nextBlinkDelay(0.5)).toBeGreaterThanOrEqual(2800)
    expect(nextBlinkDelay(0.99)).toBeLessThanOrEqual(6000)
  })
})
