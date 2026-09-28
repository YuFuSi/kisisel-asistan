import { describe, expect, it } from 'vitest'
import { cleanTitle } from './title'

describe('cleanTitle', () => {
  it('tırnak ve sondaki noktalamayı temizler', () => {
    expect(cleanTitle('"Tatil planı."')).toBe('Tatil planı')
  })

  it('düşünme bloğunu atar', () => {
    expect(cleanTitle('<think>hangi başlık olsun</think>\nKahve tarifi')).toBe('Kahve tarifi')
  })

  it('"Başlık:" önekini kaldırır', () => {
    expect(cleanTitle('Başlık: Haftalık plan')).toBe('Haftalık plan')
  })

  it('uzun başlığı kısaltır', () => {
    const long = cleanTitle('a'.repeat(80))
    expect(long).toHaveLength(48)
    expect(long.endsWith('…')).toBe(true)
  })

  it('boş metin için boş döner', () => {
    expect(cleanTitle('<think>bos</think>')).toBe('')
  })

  it('düşünce önekiyle başlayan tek satırı reddeder', () => {
    expect(cleanTitle('THOUGHTS: The user wants a short title (max 5 words)')).toBe('')
  })

  it('çok satırlı çıktıda son satırı başlık alır', () => {
    expect(cleanTitle('Thinking: kısa bir başlık lazım.\n\nKahve tarifi')).toBe('Kahve tarifi')
  })

  it('kapanmamış düşünme bloğunu atar', () => {
    expect(cleanTitle('<think>hangi başlık olsun, kısa olmalı')).toBe('')
  })

  it('başıboş kapanış etiketinden öncesini atar', () => {
    expect(cleanTitle('kullanıcı tarif istiyor</think>Kahve tarifi')).toBe('Kahve tarifi')
  })
})
