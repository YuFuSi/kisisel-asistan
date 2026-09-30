import { describe, expect, it } from 'vitest'
import { finishedOutcome, shouldCelebrate } from './outcome'

describe('finishedOutcome', () => {
  it('araç yoksa veya hepsi çalıştıysa tamamlandı', () => {
    expect(finishedOutcome([], false)).toBe('completed')
    expect(finishedOutcome([false, false], false)).toBe('completed')
  })

  it('bir araç hata verdiyse kısmi', () => {
    expect(finishedOutcome([false, true], false)).toBe('partial')
  })

  it('reddedilen onay her şeyin önüne geçer', () => {
    expect(finishedOutcome([false], true)).toBe('rejected')
  })
})

describe('shouldCelebrate', () => {
  it('düz metin cevabını kutlamaz', () => {
    expect(shouldCelebrate('completed', 0)).toBe(false)
  })

  it('araçla tamamlanan işi kutlar, kısmi işi kutlamaz', () => {
    expect(shouldCelebrate('completed', 2)).toBe(true)
    expect(shouldCelebrate('partial', 2)).toBe(false)
  })
})
