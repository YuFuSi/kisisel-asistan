import { describe, expect, it } from 'vitest'
import { SentenceSplitter } from './sentences'

describe('SentenceSplitter', () => {
  it('parça parça gelen metni tamamlanan cümlelere böler', () => {
    const splitter = new SentenceSplitter()
    expect(splitter.push('Bugün hava İstanbul')).toEqual([])
    expect(splitter.push("'da güneşli ve 24 derece. Yarın ")).toEqual([
      "Bugün hava İstanbul'da güneşli ve 24 derece."
    ])
    expect(splitter.push('yağış bekleniyor, şemsiye almayı unutma! Görüşürüz')).toEqual([
      'Yarın yağış bekleniyor, şemsiye almayı unutma!'
    ])
    expect(splitter.flush()).toBe('Görüşürüz')
    expect(splitter.flush()).toBeNull()
  })

  it('kısa cümleleri sonrakiyle birleştirir, ondalık sayıda bölmez', () => {
    const splitter = new SentenceSplitter()
    expect(splitter.push('Tamam. Görevin listeye eklendi, fiyat 3.5 lira. ')).toEqual([
      'Tamam. Görevin listeye eklendi, fiyat 3.5 lira.'
    ])
  })

  it('satır sonunda kısa olsa da böler', () => {
    const splitter = new SentenceSplitter()
    expect(splitter.push('Başlık\nİkinci satır')).toEqual(['Başlık'])
  })
})
