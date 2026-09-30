import { describe, expect, it } from 'vitest'
import { finishedOutcome, shouldCelebrate } from './outcome'

describe('finishedOutcome', () => {
  it('araç yoksa veya hepsi çalıştıysa tamamlandı', () => {
    expect(finishedOutcome([], [])).toBe('completed')
    expect(finishedOutcome([false, false], ['approved'])).toBe('completed')
  })

  it('bir araç hata verdiyse kısmi', () => {
    expect(finishedOutcome([false, true], [])).toBe('partial')
  })

  it('reddedilen onay araç hatasının, süresi dolan onay reddin önüne geçer', () => {
    expect(finishedOutcome([true], ['denied'])).toBe('rejected')
    expect(finishedOutcome([true], ['denied', 'timeout'])).toBe('timeout')
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
