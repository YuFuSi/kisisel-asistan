import { APICallError } from 'ai'
import { getSettings } from '../settings'
import { PROVIDERS } from '../../shared/api'

// Hata zincirindeki (cause) tüm mesajları ve hata kodlarını tek metinde topla
function collectMessages(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  for (let depth = 0; current && depth < 5; depth++) {
    if (!(current instanceof Error)) {
      parts.push(String(current))
      break
    }
    parts.push(current.name, current.message)
    const code = (current as NodeJS.ErrnoException).code
    if (code) parts.push(code)
    current = current.cause
  }
  return parts.join(' | ')
}

// Sağlayıcıdan gelen teknik hatayı kullanıcının anlayacağı Türkçe mesaja çevirir
export function describeError(err: unknown): string {
  const { provider, models, ollamaBaseUrl } = getSettings()
  const label = PROVIDERS[provider].label
  const model = models[provider]
  // Yeniden denemeler tükenince AI SDK asıl hatayı lastError içinde saklar
  const actual =
    err && typeof err === 'object' && 'lastError' in err
      ? (err as { lastError: unknown }).lastError
      : err

  const notFound =
    provider === 'ollama'
      ? `"${model}" modeli bulunamadı. Terminalde "ollama pull ${model}" komutuyla indirebilirsin.`
      : `"${model}" modeli bulunamadı. Ayarlar'dan model adını kontrol et.`

  if (APICallError.isInstance(actual) && actual.statusCode) {
    const status = actual.statusCode
    if (status === 401 || status === 403) {
      return `${label} API anahtarı geçersiz veya bu işlem için yetkisi yok. Ayarlar'dan anahtarı kontrol et.`
    }
    if (status === 404) return notFound
    if (status === 429) return `${label} kullanım limitine ulaşıldı. Biraz bekleyip tekrar dene.`
    if (status >= 500)
      return `${label} sunucusunda bir sorun oluştu (${status}). Biraz sonra tekrar dene.`
  }

  const text = collectMessages(actual)
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|Cannot connect/i.test(text)) {
    return provider === 'ollama'
      ? `Ollama'ya bağlanılamadı (${ollamaBaseUrl}). Ollama uygulamasının açık olduğundan emin ol.`
      : `${label} sunucusuna bağlanılamadı. İnternet bağlantını kontrol et.`
  }
  if (/TimeoutError|timed? ?out/i.test(text)) {
    return 'Model zamanında cevap vermedi. Model büyükse ilk yükleme uzun sürebilir, tekrar dene.'
  }
  if (/model .*not found/i.test(text)) return notFound

  return actual instanceof Error ? actual.message : String(actual)
}
