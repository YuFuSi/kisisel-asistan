import { describe, expect, it } from 'vitest'
import { bubbleText, inQuietHours } from './companionText'

describe('bubbleText', () => {
  it('Markdown metnini düz metne çevirir', () => {
    expect(bubbleText('# Merhaba **Pıtır**')).toBe('Merhaba Pıtır')
  })

  it('kod bloğunu "(kod)" ile değiştirir', () => {
    expect(bubbleText('Örnek:\n```ts\nconst x = 1\n```\nBitti.')).toBe('Örnek: (kod) Bitti.')
  })

  it('bağlantılarda yalnızca görünen metni tutar', () => {
    expect(bubbleText('Bak [buraya](https://example.com) ve ![resim](image.png)')).toBe(
      'Bak buraya ve resim'
    )
  })

  it('uzun metni son kelime sınırında üç noktayla kısaltır', () => {
    expect(bubbleText('Bir iki üç dört', 9)).toBe('Bir iki…')
  })

  it('kelime sınırı yoksa verilen uzunlukta kısaltır', () => {
    expect(bubbleText('abcdefgh', 4)).toBe('abcd…')
  })

  it('kısa metni değiştirmeden döndürür', () => {
    expect(bubbleText('Kısa cevap', 20)).toBe('Kısa cevap')
  })
})

describe('inQuietHours', () => {
  const settings = (
    quietStart: string,
    quietEnd: string
  ): { quietStart: string; quietEnd: string } => ({ quietStart, quietEnd })
  const at = (hour: number, minute = 0): Date => new Date(2026, 0, 1, hour, minute)

  it('sessiz saat aralığının içindeyse true döndürür', () => {
    expect(inQuietHours(settings('09:00', '17:00'), at(12))).toBe(true)
  })

  it('gündüz aralığının dışındaysa false döndürür', () => {
    expect(inQuietHours(settings('09:00', '17:00'), at(17))).toBe(false)
  })

  it('gece yarısını geçen aralığın gece kısmını tanır', () => {
    expect(inQuietHours(settings('22:00', '08:00'), at(23, 30))).toBe(true)
    expect(inQuietHours(settings('22:00', '08:00'), at(7, 59))).toBe(true)
  })

  it('gece yarısını geçen aralığın gündüz kısmını sessiz saymaz', () => {
    expect(inQuietHours(settings('22:00', '08:00'), at(12))).toBe(false)
  })

  it('başlangıç dahil, bitiş hariçtir', () => {
    expect(inQuietHours(settings('22:00', '08:00'), at(22))).toBe(true)
    expect(inQuietHours(settings('22:00', '08:00'), at(8))).toBe(false)
  })

  it('ayar yoksa false döndürür', () => {
    expect(inQuietHours(null, at(23))).toBe(false)
    expect(inQuietHours(settings('', '08:00'), at(23))).toBe(false)
  })
})
