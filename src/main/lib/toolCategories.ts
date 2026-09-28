// Model çok sayıda araç arasından güvenilir seçim yapamıyor (bilinen sorun, bkz. CLAUDE.md
// "Bilinen sınırlamalar"). Bunu azaltmak için kullanıcının mesajına bakıp sadece ilgili
// kategorideki araçları modele göndermek: 42 yerine 5-10 araç görünce küçük yerel modeller
// çok daha güvenilir seçim yapıyor (Tur D'deki "kullanılamayan araçlar gizlenir" ile aynı fikir,
// burada "muhtemelen ilgisiz araçlar gizlenir" versiyonu).
//
// Bilerek basit tutuldu: anahtar kelime eşleşmesi, ekstra model çağrısı/gecikme yok. Hiçbir
// kategori eşleşmezse (kullanıcı dolaylı/belirsiz yazdıysa) `null` dönülür ve çağıran taraf
// TÜM araçları gönderir — geriye dönük güvenli, hiçbir zaman "hiç araç yok" durumuna düşülmez.

export const CORE_TOOLS = [
  'gorev_ekle',
  'gorevleri_listele',
  'gorev_tamamla',
  'hatirlatma_kur',
  'hatirlatmalari_listele',
  'hatirlatma_iptal',
  'hafizaya_kaydet',
  'hafizayi_listele',
  'hafizadan_sil',
  'gecmiste_ara'
]

interface ToolCategory {
  keywords: string[]
  tools: string[]
}

const CATEGORIES: ToolCategory[] = [
  // Görev ve hatırlatma zaten CORE_TOOLS'ta ama yine de kategori olarak listeleniyor: mesaj bu
  // kelimelerle eşleşirse "hiçbir kategori eşleşmedi, tüm araçları gönder" güvenli düşüşüne
  // düşülmez — sadece 9 çekirdek araç gönderilir, 42'nin hepsi değil.
  {
    keywords: ['görev', 'gorev', 'listeme ekle', 'yapılacak', 'todo'],
    tools: ['gorev_ekle', 'gorevleri_listele', 'gorev_tamamla']
  },
  {
    keywords: ['hatırlat', 'hatirlat', 'anımsat', 'animsat'],
    tools: ['hatirlatma_kur', 'hatirlatmalari_listele', 'hatirlatma_iptal']
  },
  {
    keywords: ['rutin', 'otomasyon', 'her gün', 'her gun', 'her hafta', 'her sabah', 'zamanla'],
    tools: ['rutin_olustur', 'rutinleri_listele', 'rutin_iptal']
  },
  {
    keywords: ['not ', 'notu', 'notlar', 'notuma'],
    tools: ['not_kaydet', 'notlarda_ara']
  },
  {
    keywords: ['hava', 'sıcaklık', 'yağmur', 'kar yağ', 'derece'],
    tools: ['hava_durumu']
  },
  {
    keywords: ['ara ', 'internet', 'web', 'google', 'haber', 'araştır'],
    tools: ['web_ara']
  },
  {
    keywords: ['sistem', 'bellek', 'ram', 'disk', 'işlemci', 'cpu'],
    tools: ['sistem_bilgisi']
  },
  {
    keywords: ['dosya', 'uygulama aç', 'programı aç', 'url', 'link', 'siteyi aç'],
    tools: ['url_ac', 'uygulama_ac', 'dosya_bul', 'dosya_ac']
  },
  {
    keywords: ['pencere'],
    tools: [
      'pencereleri_listele',
      'pencereyi_odakla',
      'pencereyi_kucult',
      'pencereyi_tasi',
      'pencereyi_boyutlandir',
      'pencereyi_kapat'
    ]
  },
  {
    keywords: ['mail', 'e-posta', 'eposta', 'gmail'],
    tools: [
      'epostalari_ozetle',
      'eposta_ara',
      'eposta_oku',
      'taslak_olustur',
      'eposta_gonder',
      'eposta_yanitla',
      'eposta_isaretle',
      'eposta_arsivle'
    ]
  },
  {
    keywords: ['takvim', 'etkinlik', 'toplantı', 'randevu'],
    tools: ['takvim_listele', 'etkinlik_ekle', 'etkinlik_guncelle', 'etkinlik_sil']
  },
  {
    keywords: ['pano', 'kopyala', 'yapıştır', 'clipboard'],
    tools: ['pano_oku', 'pano_yaz']
  },
  {
    keywords: ['belge', 'pdf', 'word', 'dosyayı oku'],
    tools: ['belge_oku']
  },
  {
    keywords: ['günlük özet', 'brifing', 'bugün özet'],
    tools: ['gunluk_ozet']
  },
  {
    keywords: ['ekran', 'ekranı gör', 'ekranda ne var', 'ne görüyorsun'],
    tools: ['ekrani_gor']
  }
]

/**
 * Mesajda geçen anahtar kelimelere göre ilgili araç adlarını döner (her zaman CORE_TOOLS dahil).
 * Hiçbir kategori eşleşmezse `null` döner — çağıran taraf bunu "tüm araçları gönder" olarak
 * yorumlamalı.
 */
export function pickToolNames(message: string): Set<string> | null {
  const lower = message.toLowerCase()
  const matched = CATEGORIES.filter((c) => c.keywords.some((k) => lower.includes(k)))
  if (matched.length === 0) return null
  return new Set([...CORE_TOOLS, ...matched.flatMap((c) => c.tools)])
}
