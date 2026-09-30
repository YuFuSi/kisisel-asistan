import { describe, expect, it } from 'vitest'
import { buildToolCard } from './toolCards'

describe('buildToolCard', () => {
  it('hava durumundan kart üretir, şehrin sadece ilk parçasını alır', () => {
    const card = buildToolCard('hava_durumu', {
      yer: 'Konya, Türkiye',
      simdi: { sicaklik: 14, durum: 'Parçalı bulutlu' },
      gunler: [{ gun: 'Çarşamba', enDusuk: 10, enYuksek: 19, yagisIhtimali: 5 }]
    })
    expect(card).toEqual({
      kind: 'weather',
      place: 'Konya',
      temperature: 14,
      condition: 'Parçalı bulutlu',
      days: [{ day: 'Çarşamba', min: 10, max: 19, rainChance: 5 }]
    })
  })

  it('boş takvim de kart olur, en fazla 5 etkinlik', () => {
    expect(buildToolCard('takvim_listele', { bulunan: 0, etkinlikler: [] })).toEqual({
      kind: 'events',
      items: []
    })
    const many = Array.from({ length: 8 }, (_, i) => ({ baslik: `E${i}`, baslangic: '10:00' }))
    const card = buildToolCard('takvim_listele', { etkinlikler: many })
    expect(card?.kind === 'events' && card.items.length).toBe(5)
  })

  it('dosya sonucunda toplam sayıyı korur', () => {
    const card = buildToolCard('dosya_bul', {
      bulunan: 12,
      dosyalar: [{ ad: 'fatura.pdf', yol: 'C:/x/fatura.pdf', boyutKb: 40 }]
    })
    expect(card).toEqual({
      kind: 'files',
      total: 12,
      items: [{ name: 'fatura.pdf', path: 'C:/x/fatura.pdf', sizeKb: 40 }]
    })
  })

  it('görev ve tek seferlik hatırlatma', () => {
    expect(
      buildToolCard('gorev_ekle', { baslik: 'Süt al', sonTarih: '2026-10-01', saat: null })
    ).toEqual({
      kind: 'task',
      title: 'Süt al',
      due: '2026-10-01'
    })
    expect(
      buildToolCard('hatirlatma_kur', {
        mesaj: 'İlaç',
        zaman: '1 Ekim 09:00',
        tekrar: 'Tek seferlik'
      })
    ).toEqual({ kind: 'reminder', message: 'İlaç', when: '1 Ekim 09:00', repeat: null })
  })

  it('bilinmeyen araç veya bozuk sonuçtan kart çıkmaz', () => {
    expect(buildToolCard('web_ara', { sonuc: [] })).toBeNull()
    expect(buildToolCard('hava_durumu', 'metin')).toBeNull()
    expect(buildToolCard('hava_durumu', { yer: 'X' })).toBeNull()
  })
})
