import { describe, expect, it } from 'vitest'
import { parseLocalDate, parseLocalDateTime, toLocalIso } from './datetime'

describe('parseLocalDateTime', () => {
  it('geçerli zamanı yerel saat olarak okur', () => {
    const date = parseLocalDateTime('2026-09-12T10:00')
    expect(date && toLocalIso(date)).toBe('2026-09-12T10:00')
  })

  it('boşluklu ve saniyeli biçimi kabul eder', () => {
    const date = parseLocalDateTime(' 2026-09-12 10:05:30 ')
    expect(date && toLocalIso(date)).toBe('2026-09-12T10:05')
  })

  it('geçersiz ve taşan değerleri reddeder', () => {
    expect(parseLocalDateTime('2026-02-31T10:00')).toBeNull()
    expect(parseLocalDateTime('2026-09-12T25:00')).toBeNull()
    expect(parseLocalDateTime('yarın 10:00')).toBeNull()
    expect(parseLocalDateTime('2026-09-12')).toBeNull()
  })
})

describe('parseLocalDate', () => {
  it('tarihi ve tarihle başlayan zamanı okur', () => {
    expect(parseLocalDate('2026-09-12')).toBe('2026-09-12')
    expect(parseLocalDate('2026-09-12T21:30')).toBe('2026-09-12')
  })

  it('geçersiz tarihleri reddeder', () => {
    expect(parseLocalDate('12.09.2026')).toBeNull()
    expect(parseLocalDate('2026-13-01')).toBeNull()
  })
})
