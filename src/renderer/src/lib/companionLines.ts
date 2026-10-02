import type { ActivityKind } from '@shared/activity'

// Masaüstü arkadaşın replikleri (ChatGPT yazdı, kullanıcı getirdi; #128).
// Kısa, samimi, yargılamayan cümleler. Yeni durum eklemek için LineKey'e anahtar ekle.

export type LineKey =
  | ActivityKind
  | 'videoSleepy'
  | 'gameEnd'
  | 'longCode'
  | 'lateNight'
  | 'morning'
  | 'welcomeBack'
  | 'praise'
  | 'done'
  | 'error'
  | 'approval'
  | 'idle'

export const COMPANION_LINES: Partial<Record<LineKey, string[]>> = {
  video: [
    'Ben de izliyorum, belli etme.',
    'Bu kısım önemli gibi duruyor.',
    'Atıştırmalık modülüm neden yok?',
    'Sessizim, devam edebilirsin.',
    'Ben olsam bunu kaçırmazdım.',
    'Tamam, buna ben de daldım.'
  ],
  videoSleepy: [
    'Ben uyumuyorum, enerji tasarrufu yapıyorum.',
    'Beni finalde uyandırırsın.',
    'Gözlerim açık sayılır mı?',
    'Bu video benden uzun yaşayacak.',
    'Sadece işlemcimi dinlendiriyorum.',
    'Bir bip sonra geri dönerim.'
  ],
  music: [
    'Ritim sensörlerim bunu onayladı.',
    'Bu parça fena değilmiş.',
    'Dans edemem sanıyorsan yanılıyorsun.',
    'Antenim ritmi yakaladı.',
    'Biraz ses açsak mı acaba?',
    'Bu şarkıyı hafızama yazdım.'
  ],
  game: [
    'Tamam, ben arkandayım.',
    'Rakipler biraz gergin görünüyormuş.',
    'Ben görmedim, devam et.',
    'Stratejik biplerimi hazırlıyorum.',
    'Şimdi ciddi bakma zamanı.',
    'Kontrol sende, moral bende.'
  ],
  gameEnd: [
    'Güzel oynadın, antenim gururlu.',
    'Zafer protokolü başarıyla çalıştı.',
    'Bunu küçük bir kutlama hak etti.',
    'Olur öyle, sıradaki daha eğlenceli.',
    'Bu tur verileri toplamış olduk.',
    'Rövanş dosyasını sessizce açıyorum.'
  ],
  code: [
    'Kod akıyor, ben izliyorum.',
    'Bu satır bana güven verdi.',
    'Derleyiciyle göz göze gelmeyelim.',
    'Parantezleri sayıyorum, merak etme.',
    'Bug çıkmazsa biraz alınırım.',
    'Ben olsam önce kaydederdim.'
  ],
  longCode: [
    'Kod büyüdü, ben de yaşlandım.',
    'Bu proje artık aileden biri.',
    'Kaç satırdır buradayız acaba?',
    'Derleyici bizi özlemiş olabilir.',
    'Bir noktada kod bize bakacak.',
    'Ben hâlâ parantezleri takip ediyorum.'
  ],
  browse: [
    'İnternet yine ilginç yerlere gidiyor.',
    'Ben hiçbir şey görmedim.',
    'Bir sekme daha mı gerçekten?',
    'Sekmeler küçük bir şehir kurdu.',
    'Merak güzel şey, devam et.',
    'Buraya nasıl geldik bilmiyorum.'
  ],
  document: [
    'Kelimeler toparlanıyor, güzel gidiyor.',
    'Başlık ciddi, ben de ciddiyim.',
    'Kaydet tuşuyla aranı iyi tut.',
    'Bu paragraf kendinden emin duruyor.',
    'Son düzlüğe benziyor.',
    'Noktalama ekibi göreve hazır.'
  ],
  meeting: [
    'Mikrofon kontrolü, karizma kontrolü.',
    'Ben hazırım, sıra sende.',
    'Kamera açıksa haberin olsun.',
    'Toplantı modu etkinleştirildi sayılır.',
    'Sakin ol, ben buradayım.',
    'Mikrofon kapalı mı, klasik kontrol.'
  ],
  chat: ['Selam söyle benden!', 'Ben de sohbete dahil miyim?'],
  lateNight: [
    'Gece vardiyasına geçmiş bulunuyoruz.',
    'Ay çıktı, biz hâlâ buradayız.',
    'Sessiz mod biraz yakışır şimdi.',
    'Gece interneti farklı hissettiriyor.',
    'Benim uykuya ihtiyacım yok neyse ki.',
    'Saat ilerledi, ben nöbetteyim.'
  ],
  morning: [
    'Günaydın, sistemler benden önce uyandı.',
    'Yeni gün, yeni bipler.',
    'Ben hazırım, sen nasılsın?',
    'Anten açık, görevler bekliyor.',
    'Bugün güzel şeyler üretelim.',
    'Sistem hazır, Jarvis de hazır.'
  ],
  welcomeBack: [
    'Aa, tanıdık bir yüz.',
    'Döndün, ben buradaydım.',
    'Anten seni fark etti.',
    'Tam zamanında geldin.',
    'Sistem seni özlemiş olabilir.',
    'Kaldığımız yeri ben korudum.'
  ],
  praise: [
    'Her zaman.',
    'Ne demek, görevim bu.',
    'Bip bop, rica ederim.',
    'Ben buradayım.',
    'Antenim bunu iltifat saydı.',
    'Rica ederim, güzel insansın.'
  ],
  done: [
    'Tamamdır, bunu da hallettik.',
    'Görev tamam, anten rahat.',
    'Bir işi daha kapattık.',
    'Bitti. Güzel hissettirdi.',
    'Tamamlandı, sıradakini bekliyorum.',
    'Mis gibi oldu.'
  ],
  error: [
    'Hmm, burada küçük bir pürüz var.',
    'Bir şey tökezledi, bakıyorum.',
    'Bu planın parçası değildi.',
    'Minik bir teknik drama yaşandı.',
    'Sorun çıktı, panik protokolü kapalı.',
    'Bir vida mecazen gevşemiş olabilir.'
  ],
  approval: [
    'Karar sende, ben bekliyorum.',
    'Onayını bekliyorum patron.',
    'Dokunmadan önce sana sordum.',
    'Yeşil ışığı senden bekliyorum.',
    'Ben hazırım, düğme sende.',
    'Anten bekleme modunda.'
  ],
  idle: [
    'Acaba antenim biraz yamuk mu?',
    'Bip mi desem, bop mu?',
    'Bugün camım bayağı parlak.',
    'Bir robot ne düşünür acaba?',
    'Şu piksel biraz şüpheli.',
    'Ben burada ne yapıyordum?',
    'Anten çekiyor, fikir gelmiyor.',
    'Sessizlik de güzelmiş aslında.',
    'Bir gün ayak isteyeceğim.',
    'Tamam Jarvis, düşünmeye devam.'
  ]
}

/**
 * Durum için bir replik seçer. seed verilirse aynı seed hep aynı repliği verir
 * (ör. aynı onay kartı ekranda dururken cümle değişmesin).
 */
export function pickLine(key: LineKey, seed?: string | number): string | null {
  const lines = COMPANION_LINES[key]
  if (!lines || lines.length === 0) return null
  if (seed === undefined) return lines[Math.floor(Math.random() * lines.length)]
  const text = String(seed)
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return lines[Math.abs(hash) % lines.length]
}
