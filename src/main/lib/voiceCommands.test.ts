import { describe, expect, it } from 'vitest'
import { isStopRequest, parseConfirmation } from './voiceCommands'

describe('parseConfirmation', () => {
  it('evet cevaplarını anlar', () => {
    for (const text of ['Evet.', 'onaylıyorum', 'Tamamdır, yap', 'olur', 'Tabii ki']) {
      expect(parseConfirmation(text), text).toBe('yes')
    }
  })

  it('hayır cevaplarını anlar ve rette kazanır', () => {
    for (const text of ['Hayır', 'İptal et', 'vazgeçtim', 'tamam iptal', 'yapma', 'istemiyorum']) {
      expect(parseConfirmation(text), text).toBe('no')
    }
  })

  it('ilgisiz cümlede karar vermez', () => {
    expect(parseConfirmation('Hava nasıl olacak')).toBeNull()
  })
})

describe('isStopRequest', () => {
  it('kısa bitirme komutlarını anlar', () => {
    // "Taman diyeterli." gerçek denemede whisper'ın "Tamam, yeter." için yazdığı metin
    for (const text of ['Dur', 'Tamam yeter', 'Görüşürüz Jarvis', 'sus', 'Taman diyeterli.']) {
      expect(isStopRequest(text), text).toBe(true)
    }
  })

  it('uzun cümleleri ve "durum" sorularını kesmez', () => {
    expect(isStopRequest('Hava durumu nasıl')).toBe(false)
    expect(isStopRequest('Yarın sabah dokuzda durağa gitmemi hatırlat lütfen')).toBe(false)
  })
})
