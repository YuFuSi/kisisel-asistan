// Whisper sessizlikte veya gürültüde, eğitim verisindeki altyazılardan kalma cümleler "uydurabiliyor".
// Bu cümleler tek başına geldiyse konuşma yok sayılır.
// Desenler Türkçe küçük harfe çevrilmiş metne uygulanır ("İ" harfi /i bayrağıyla "i" sayılmıyor)
const HALLUCINATIONS = [
  /altyazı/,
  /izlediğiniz için teşekkür/,
  /abone ol/,
  /bir sonraki videoda görüşmek/,
  /^(teşekkürler|teşekkür ederim)[.!]?$/
]
// Uydurma cümleler kısa olur; uzun gerçek bir cümle içinde geçerse silinmez
const HALLUCINATION_MAX_WORDS = 7

/**
 * Konuşma tanıma çıktısını temizler: [BLANK_AUDIO], (müzik) gibi işaretleri siler,
 * sadece noktalama veya bilinen uydurma cümle kaldıysa boş döner.
 */
export function cleanTranscript(text: string): string {
  const result = text
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!/[\p{L}\p{N}]/u.test(result)) return ''
  const words = result.split(' ').length
  const lower = result.toLocaleLowerCase('tr-TR')
  if (words <= HALLUCINATION_MAX_WORDS && HALLUCINATIONS.some((pattern) => pattern.test(lower))) {
    return ''
  }
  return result
}
