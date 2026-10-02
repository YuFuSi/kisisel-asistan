// Akıllı gözün görüntü modelinden gelen cevabını balona uygun tek bir Türkçe cümleye indirir

/** Model çıktısını tek, kısa bir cümleye indirir; uygun değilse null */
export function cleanRemark(text: string): string | null {
  const first = text
    .replace(/["“”*_#`]/g, '')
    // Emoji ve semboller atılır (balonda sade metin)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '')
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!first) return null
  const words = first.split(/\s+/)
  if (words.length < 2 || words.length > 20) return null
  // Türkçe olmayan (ör. Çince/İngilizce) çıktıları gösterme
  if (/[㐀-鿿]/.test(first)) return null
  if (!/[çğıöşüÇĞİÖŞÜ]|\b(bu|bir|ne|çok|ve|gibi|mı|mi|da|de)\b/i.test(first)) return null
  return first
}
