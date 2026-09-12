import { describe, expect, it } from 'vitest'
import { findSimilarMemory, memorySimilarity, rankMemories } from './memoryRank'

const memories = [
  { id: 1, content: 'Kahvesini şekersiz içer' },
  { id: 2, content: 'Kızının adı Elif' },
  { id: 3, content: 'Pazartesi günleri spora gider' },
  { id: 4, content: 'İstanbul Kadıköy’de yaşıyor' }
]

describe('memorySimilarity', () => {
  it('ekleri farklı aynı bilgiyi benzer bulur', () => {
    expect(memorySimilarity('Kahvesini şekersiz içer', 'Kahveyi şekersiz içer')).toBeGreaterThan(
      0.6
    )
  })

  it('tek kelimesi farklı iki ayrı kişiyi birleştirmez', () => {
    // "Kızı" ve "oğlu" farklı kişiler; benzerlik eşiğin (0,6) altında kalmalı
    expect(memorySimilarity('Kızının adı Elif', 'Oğlunun adı Elif')).toBeLessThan(0.6)
  })

  it('ilgisiz bilgileri benzer bulmaz', () => {
    expect(memorySimilarity('Kahvesini şekersiz içer', 'Kızının adı Elif')).toBe(0)
  })

  it('boş metinde 0 döner', () => {
    expect(memorySimilarity('', 'bir şey')).toBe(0)
  })
})

describe('findSimilarMemory', () => {
  it('benzer kaydı bulur', () => {
    expect(findSimilarMemory(memories, 'Kahveyi şekersiz içer')?.id).toBe(1)
  })

  it('yeni bilgide undefined döner', () => {
    expect(findSimilarMemory(memories, 'Kedisi var')).toBeUndefined()
  })
})

describe('rankMemories', () => {
  it('sınırın altındaysa hepsini döndürür', () => {
    expect(rankMemories(memories, 'merhaba', 10)).toHaveLength(4)
  })

  it('soruyla ilgili kaydı öne alır', () => {
    const ranked = rankMemories(memories, 'Bu pazartesi spor programımı hazırla', 2)
    expect(ranked[0].id).toBe(3)
    expect(ranked).toHaveLength(2)
    // Kalan yer en yeni kayıtla dolar
    expect(ranked[1].id).toBe(4)
  })
})
