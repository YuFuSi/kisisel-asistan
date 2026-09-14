// Sesli sohbette kısa cevapları anlama: onay kartına "evet/hayır", konuşmayı bitirmek için "dur".

const normalize = (text: string): string[] =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

// Kelime kökleri; "onaylıyorum", "tamamdır", "vazgeçtim" gibi ekli halleri de yakalar
const NO_STEMS = ['hayır', 'iptal', 'vazgeç', 'yapma', 'istemiyorum', 'reddet', 'olmaz', 'dur']
const YES_STEMS = ['evet', 'onay', 'tamam', 'olur', 'peki', 'yap', 'devam', 'kabul', 'tabii']
const STOP_STEMS = ['dur', 'sus', 'yeter', 'kapat', 'görüşürüz', 'hoşça', 'bitir']
// Konuşma tanıma kısa komutlarda kelimeleri birleştirebiliyor ("Tamam, yeter" → "Taman diyeterli").
// Uzun kökler bu yüzden kelimenin içinde de aranır; "dur", "sus" gibi kısa kökler aranmaz ("durum", "susam").
const STOP_INNER_STEMS = ['yeter', 'görüşürüz', 'bitir']
// "Dur" komutu sadece kısa cümlelerde geçerli; "durum nedir" gibi soruları kesmesin
const STOP_MAX_WORDS = 4

const hasStem = (words: string[], stems: string[]): boolean =>
  words.some((word) => stems.some((stem) => word === stem || word.startsWith(stem)))

/** Onay sorusuna verilen sesli cevap: evet, hayır veya anlaşılamadı (null) */
export function parseConfirmation(text: string): 'yes' | 'no' | null {
  const words = normalize(text)
  // Önce ret aranır: "hayır yapma", "tamam iptal et" gibi cümlelerde ret kazanır
  if (hasStem(words, NO_STEMS)) return 'no'
  if (hasStem(words, YES_STEMS)) return 'yes'
  return null
}

/** Kullanıcı sesli sohbeti bitirmek mi istiyor ("dur", "tamam yeter", "görüşürüz") */
export function isStopRequest(text: string): boolean {
  const words = normalize(text).filter((word) => !word.startsWith('durum'))
  if (words.length === 0 || words.length > STOP_MAX_WORDS) return false
  return (
    hasStem(words, STOP_STEMS) ||
    words.some((word) => STOP_INNER_STEMS.some((stem) => word.includes(stem)))
  )
}
