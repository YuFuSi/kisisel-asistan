import { describe, expect, it } from 'vitest'
import {
  buildExtractionPrompt,
  formatTranscript,
  isSensitive,
  parseExtraction
} from './memoryExtraction'

describe('parseExtraction', () => {
  it('düzgün JSON’dan özet ve türlü bilgileri çıkarır', () => {
    const result = parseExtraction(
      '{"ozet": "Tatil planı konuşuldu.", "bilgiler": [{"tur": "plan", "metin": "Kullanıcı Ekim’de Antalya’ya gidecek."}, {"tur": "kişi", "metin": "Kullanıcının kızının adı Elif."}]}'
    )
    expect(result).toEqual({
      summary: 'Tatil planı konuşuldu.',
      facts: [
        { kind: 'plan', content: 'Kullanıcı Ekim’de Antalya’ya gidecek.' },
        { kind: 'kisi', content: 'Kullanıcının kızının adı Elif.' }
      ]
    })
  })

  it('düşünme bloğu, kod çiti ve etraftaki metni yok sayar', () => {
    const raw =
      '<think>kullanıcı ne dedi</think>İşte sonuç:\n```json\n{"ozet":"Selamlaşma.","bilgiler":[]}\n```'
    expect(parseExtraction(raw)).toEqual({ summary: 'Selamlaşma.', facts: [] })
  })

  it('bozuk veya JSON olmayan cevapta null döner', () => {
    expect(parseExtraction('Bir şey çıkaramadım.')).toBeNull()
    expect(parseExtraction('{"ozet": "yarım')).toBeNull()
    expect(parseExtraction('{"baska": 1}')).toBeNull()
  })

  it('bilinmeyen türü bilgi sayar, düz metin bilgiyi de kabul eder, tekrarı atar', () => {
    const result = parseExtraction(
      '{"ozet":"x","bilgiler":[{"tur":"hobi","metin":"Kullanıcı satranç oynar."},"Kullanıcı satranç oynar.","ok"]}'
    )
    expect(result?.facts).toEqual([{ kind: 'bilgi', content: 'Kullanıcı satranç oynar.' }])
  })

  it('hassas bilgiyi model yazsa bile atar', () => {
    const result = parseExtraction(
      '{"ozet":"Banka işi","bilgiler":[{"tur":"bilgi","metin":"Kullanıcının kartı 4111 1111 1111 1111"},{"tur":"bilgi","metin":"Kullanıcının Gmail şifresi: Kedi1234"},{"tur":"tercih","metin":"Kullanıcı sabahları çay içer."}]}'
    )
    expect(result?.facts).toEqual([{ kind: 'tercih', content: 'Kullanıcı sabahları çay içer.' }])
  })

  it('en fazla 10 bilgi alır', () => {
    const facts = Array.from({ length: 15 }, (_, i) => ({
      tur: 'bilgi',
      metin: `Kullanıcı bilgi ${i}`
    }))
    expect(parseExtraction(JSON.stringify({ ozet: 'x', bilgiler: facts }))?.facts).toHaveLength(10)
  })
})

describe('isSensitive', () => {
  it('kart, IBAN, TC kimlik, API anahtarı ve şifreyi yakalar', () => {
    expect(isSensitive('kart 4111-1111-1111-1111')).toBe(true)
    expect(isSensitive('TR33 0006 1005 1978 6457 8413 26')).toBe(true)
    expect(isSensitive('TC 12345678901')).toBe(true)
    expect(isSensitive('anahtar sk-proj-abcdefghijklmnop')).toBe(true)
    expect(isSensitive('wifi parolası: evdeki123')).toBe(true)
  })

  it('sıradan bilgiyi hassas saymaz', () => {
    expect(isSensitive('Kullanıcı 1995 doğumlu ve 3 kedisi var.')).toBe(false)
    expect(isSensitive('Kullanıcı şifre yöneticisi olarak Bitwarden kullanıyor.')).toBe(false)
  })
})

describe('formatTranscript ve buildExtractionPrompt', () => {
  it('rolleri etiketler, belge içeriğini atar', () => {
    const text = formatTranscript([
      {
        role: 'user',
        content: 'Şunu özetle\n[[BELGE ad="rapor.pdf" parca="1/1"]]\ngizli içerik\n[[/BELGE]]'
      },
      { role: 'assistant', content: 'Tamam.' }
    ])
    expect(text).toContain('Kullanıcı: Şunu özetle')
    expect(text).toContain('[1 belge eklendi]')
    expect(text).not.toContain('gizli içerik')
    expect(text).toContain('Pıtır: Tamam.')
  })

  it('çok uzun sohbette en yeni kısmı tutar', () => {
    const long = formatTranscript([
      { role: 'user', content: 'ESKİ ' + 'a'.repeat(20_000) },
      { role: 'user', content: 'YENİ son mesaj' }
    ])
    expect(long).toContain('YENİ son mesaj')
    expect(long).not.toContain('ESKİ')
  })

  it('konuşma tarihini gün adıyla ekler', () => {
    const prompt = buildExtractionPrompt('Kullanıcı: selam', [], null, new Date(2026, 8, 28, 12))
    expect(prompt).toContain('Konuşmanın tarihi: 28 Eylül 2026 Pazartesi')
  })

  it('bilinenleri ve önceki özeti isteğe ekler', () => {
    const prompt = buildExtractionPrompt(
      'Kullanıcı: selam',
      ['Kullanıcının adı Yusuf.'],
      'Önce x konuşuldu.'
    )
    expect(prompt).toContain('- Kullanıcının adı Yusuf.')
    expect(prompt).toContain('Önce x konuşuldu.')
    expect(prompt.endsWith('Kullanıcı: selam')).toBe(true)
  })
})
