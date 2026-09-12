import { getAccessToken } from './auth'
import { describeGooglePermissionError } from './errors'

const REQUEST_TIMEOUT_MS = 20_000

export interface GoogleRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

/** Google API isteklerinin ortak katmanı: erişim anahtarı, zaman aşımı ve Türkçe hata mesajları */
export async function googleRequest<T>(
  url: string,
  options: GoogleRequestOptions = {}
): Promise<T> {
  const token = await getAccessToken()
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url

  let response: Response
  try {
    response = await fetch(fullUrl, {
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body ? { 'content-type': 'application/json' } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw new Error('Google servisine bağlanılamadı. İnternet bağlantını kontrol et.')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 401) {
      throw new Error("Google bağlantısı geçersiz. Ayarlar'dan hesabı yeniden bağla.")
    }
    if (response.status === 403) {
      throw new Error(
        describeGooglePermissionError(text) ??
          'Google bu işlem için izin vermedi. Hesabı bağlarken istenen izinlerin hepsini onayladığından emin ol.'
      )
    }
    if (response.status === 429) {
      throw new Error('Google kullanım limitine ulaşıldı. Biraz bekleyip tekrar dene.')
    }
    if (response.status === 404) throw new Error('Google aradığın kaydı bulamadı.')
    throw new Error(`Google servisi hata verdi (HTTP ${response.status}). ${text.slice(0, 200)}`)
  }

  // Silme gibi işlemler boş cevap (204) döndürür
  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}
