import { generateText, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOllama } from 'ollama-ai-provider-v2'
import { getApiKey, getSettings } from '../settings'
import { describeError } from './errors'
import { PROVIDERS, type CloudProviderId, type ConnectionResult } from '../../shared/api'

function requireApiKey(provider: CloudProviderId): string {
  const key = getApiKey(provider)
  if (!key) {
    throw new Error(
      `${PROVIDERS[provider].label} için API anahtarı girilmemiş. Ayarlar'dan ekleyebilirsin.`
    )
  }
  return key
}

// Ayarlarda seçili sağlayıcı ve modele göre AI SDK model nesnesi oluşturur.
// Yeni bir sağlayıcı eklemek için buraya bir "case" eklemek yeterli.
export function getModel(): LanguageModel {
  const { provider, models, ollamaBaseUrl } = getSettings()
  const modelId = models[provider]
  if (!modelId) throw new Error("Henüz bir model seçilmedi. Ayarlar'dan bir model seç.")

  switch (provider) {
    case 'ollama':
      return createOllama({ baseURL: `${ollamaBaseUrl}/api` })(modelId)
    case 'openai':
      return createOpenAI({ apiKey: requireApiKey('openai') })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: requireApiKey('google') })(modelId)
    case 'anthropic':
      return createAnthropic({ apiKey: requireApiKey('anthropic') })(modelId)
  }
}

export async function listOllamaModels(): Promise<string[]> {
  const { ollamaBaseUrl } = getSettings()
  let response: Response
  try {
    response = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
  } catch {
    throw new Error(
      `Ollama'ya bağlanılamadı (${ollamaBaseUrl}). Ollama uygulamasının açık olduğundan emin ol.`
    )
  }
  if (!response.ok) throw new Error(`Ollama model listesi alınamadı (HTTP ${response.status}).`)
  const data = (await response.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name).sort((a, b) => a.localeCompare(b))
}

export async function testConnection(): Promise<ConnectionResult> {
  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: 'Bu bir bağlantı testi. Sadece "Merhaba" yaz.',
      maxRetries: 0,
      timeout: 120_000
    })
    const reply = text.replace(/\s+/g, ' ').trim().slice(0, 80)
    return { ok: true, message: `Bağlantı başarılı. Modelin cevabı: "${reply}"` }
  } catch (err) {
    return { ok: false, message: describeError(err) }
  }
}
