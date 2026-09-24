import { describe, expect, it } from 'vitest'
import { CORE_TOOLS, pickToolNames } from './toolCategories'

describe('pickToolNames', () => {
  it('eşleşme yoksa null döner (tüm araçlar gönderilsin)', () => {
    expect(pickToolNames('bugün nasılsın')).toBeNull()
  })

  it('her zaman CORE_TOOLS içerir', () => {
    const result = pickToolNames('hava nasıl')
    for (const tool of CORE_TOOLS) {
      expect(result?.has(tool)).toBe(true)
    }
  })

  it('rutin isteğinde otomasyon araçlarını seçer', () => {
    const result = pickToolNames('her gün sabah 9da rutin kur')
    expect(result?.has('rutin_olustur')).toBe(true)
    expect(result?.has('web_ara')).toBe(false)
  })

  it('e-posta isteğinde gmail araçlarını seçer', () => {
    const result = pickToolNames('son 5 e-postamı özetler misin')
    expect(result?.has('epostalari_ozetle')).toBe(true)
    expect(result?.has('takvim_listele')).toBe(false)
  })

  it('takvim isteğinde calendar araçlarını seçer', () => {
    const result = pickToolNames('yarınki toplantımı takvime ekle')
    expect(result?.has('etkinlik_ekle')).toBe(true)
  })

  it('birden fazla kategori eşleşirse hepsini birleştirir', () => {
    const result = pickToolNames('hava durumuna bak ve pencereyi kapat')
    expect(result?.has('hava_durumu')).toBe(true)
    expect(result?.has('pencereyi_kapat')).toBe(true)
  })

  it('hatırlatma isteğinde "hiçbir kategori eşleşmedi" düşüşüne düşmez', () => {
    // Canlı testte bulunan gerçek bir örnek: bu cümle hiçbir kategoriyle eşleşmeyip tüm 42
    // aracın gönderilmesine (ve modelin boş cevap dönmesine) yol açmıştı
    const result = pickToolNames('her gun sabah 9da su icmemi hatirlat')
    expect(result).not.toBeNull()
    expect(result?.has('hatirlatma_kur')).toBe(true)
  })

  it('büyük/küçük harfe duyarsızdır', () => {
    // Türkçe "İ/I" harfleri JS'in locale'siz toLowerCase'inde tuzak olduğu için (bkz. CLAUDE.md,
    // arama özelliğindeki aynı sorun) ASCII harfli bir anahtar kelimeyle test edilir
    const result = pickToolNames('MAIL geldi mi bakar mısın')
    expect(result?.has('epostalari_ozetle')).toBe(true)
  })
})
