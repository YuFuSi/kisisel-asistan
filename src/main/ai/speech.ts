import { getSecret, getSettings } from '../settings'
import { cleanTranscript } from '../lib/transcript'
import { getWhisper } from '../voice/engines'
import { SPEECH_PROVIDERS, type SpeechProvider } from '../../shared/api'

interface SpeechEndpoint {
  url: string
  model: string
}

type CloudSpeechProvider = Exclude<SpeechProvider, 'local'>

// Bulut servislerinin ikisi de OpenAI uyumlu "audio/transcriptions" arayüzünü kullanıyor
const ENDPOINTS: Record<CloudSpeechProvider, SpeechEndpoint> = {
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

export function speechEndpoint(provider: CloudSpeechProvider): SpeechEndpoint {
  return ENDPOINTS[provider]
}

async function transcribeCloud(
  provider: CloudSpeechProvider,
  audio: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const info = SPEECH_PROVIDERS[provider]
  const key = info.secret ? getSecret(info.secret) : undefined
  if (!key) {
    throw new Error(
      `Konuşmayı yazıya çevirmek için ${info.label} API anahtarı gerekiyor. Ayarlar sayfasındaki Ses bölümünden ekleyebilirsin.`
    )
  }

  const { url, model } = ENDPOINTS[provider]
  const type = mimeType || 'audio/wav'
  const form = new FormData()
  form.append(
    'file',
    new Blob([audio], { type }),
    type.includes('webm') ? 'kayit.webm' : 'kayit.wav'
  )
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
  return data.text ?? ''
}

/**
 * Ses kaydını seçili servisle metne çevirir. Yerel servis (whisper.cpp) 16 kHz WAV ister;
 * arayüz kayıtları bu yüzden WAV olarak gönderir.
 */
export async function transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string> {
  if (audio.byteLength === 0) throw new Error('Ses kaydı boş, tekrar dene.')
  if (audio.byteLength > MAX_BYTES) throw new Error('Ses kaydı çok uzun, daha kısa konuş.')

  const provider = getSettings().sttProvider
  const raw =
    provider === 'local'
      ? await getWhisper().transcribe(audio)
      : await transcribeCloud(provider, audio, mimeType)
  const text = cleanTranscript(raw)
  if (!text) throw new Error('Konuşma anlaşılamadı, tekrar dene.')
  return text
}
