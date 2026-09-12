import { getSecret, getSettings } from '../settings'
import { SPEECH_PROVIDERS, type SpeechProvider } from '../../shared/api'

interface SpeechEndpoint {
  url: string
  model: string
}

// Her iki servis de OpenAI uyumlu "audio/transcriptions" arayüzünü kullanıyor
const ENDPOINTS: Record<SpeechProvider, SpeechEndpoint> = {
  groq: {
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo'
  },
  openai: {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1'
  }
}

const TIMEOUT_MS = 60_000
const MAX_BYTES = 20 * 1024 * 1024

export function speechEndpoint(provider: SpeechProvider): SpeechEndpoint {
  return ENDPOINTS[provider]
}

/** Mikrofon kaydını seçili servise gönderip metne çevirir */
export async function transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string> {
  if (audio.byteLength === 0) throw new Error('Ses kaydı boş, tekrar dene.')
  if (audio.byteLength > MAX_BYTES) throw new Error('Ses kaydı çok uzun, daha kısa konuş.')

  const provider = getSettings().sttProvider
  const info = SPEECH_PROVIDERS[provider]
  const key = getSecret(info.secret)
  if (!key) {
    throw new Error(
      `Konuşmayı yazıya çevirmek için ${info.label} API anahtarı gerekiyor. Ayarlar sayfasındaki Ses bölümünden ekleyebilirsin.`
    )
  }

  const { url, model } = ENDPOINTS[provider]
  const form = new FormData()
  form.append('file', new Blob([audio], { type: mimeType || 'audio/webm' }), 'kayit.webm')
  form.append('model', model)
  form.append('language', 'tr')
  form.append('response_format', 'json')

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch {
    throw new Error(`${info.label} servisine bağlanılamadı. İnternet bağlantını kontrol et.`)
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`${info.label} API anahtarı geçersiz. Ayarlar'dan kontrol et.`)
  }
  if (response.status === 429) {
    throw new Error(`${info.label} kullanım limitine ulaşıldı. Biraz bekleyip tekrar dene.`)
  }
  if (!response.ok) {
    throw new Error(`Ses yazıya çevrilemedi (HTTP ${response.status}).`)
  }

  const data = (await response.json()) as { text?: string }
  const text = (data.text ?? '').trim()
  if (!text) throw new Error('Konuşma anlaşılamadı, tekrar dene.')
  return text
}
