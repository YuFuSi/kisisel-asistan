import { describe, expect, it } from 'vitest'
import { describeToolInput } from './activityText'

describe('describeToolInput', () => {
  it('metin ve sayı alanlarını birleştirir', () => {
    expect(describeToolInput({ baslik: '  Süt   al ', tarih: '2026-09-15', id: 3 })).toBe(
      'Süt al · 2026-09-15 · 3'
    )
  })

  it('iç içe nesneleri, boş ve mantıksal değerleri atlar', () => {
    expect(describeToolInput({ a: '', b: true, c: { d: 'x' }, e: 'tamam' })).toBe('tamam')
    expect(describeToolInput(undefined)).toBe('')
    expect(describeToolInput('düz metin')).toBe('düz metin')
  })

  it('uzun açıklamayı kısaltır', () => {
    const text = describeToolInput({ metin: 'a'.repeat(500) })
    expect(text).toHaveLength(120)
    expect(text.endsWith('…')).toBe(true)
  })
})
