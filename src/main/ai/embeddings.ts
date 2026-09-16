import { getSettings } from '../settings'

/** Anlamsal arama için kullanılan gömme (embedding) modeli. Ollama üzerinden çekilir. */
export const EMBEDDING_MODEL = 'bge-m3'

interface OllamaEmbedResponse {
  embeddings?: number[][]
}

/** Bir metnin gömme vektörünü Ollama üzerinden hesaplar. */
export async function embedText(text: string): Promise<Float32Array> {
  const { ollamaBaseUrl } = getSettings()
  let response: Response
  try {
    response = await fetch(`${ollamaBaseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal: AbortSignal.timeout(30_000)
    })
  } catch {
    throw new Error(
      `Ollama'ya bağlanılamadı (${ollamaBaseUrl}). Ollama uygulamasının açık olduğundan emin ol.`
    )
  }

  if (response.status === 404) {
    throw new Error(
      `Anlamsal arama modeli ("${EMBEDDING_MODEL}") bulunamadı. Terminalde "ollama pull ${EMBEDDING_MODEL}" ile indirebilirsin.`
    )
  }
  if (!response.ok) {
    throw new Error(`Gömme (embedding) hesaplanamadı (HTTP ${response.status}).`)
  }

  const data = (await response.json()) as OllamaEmbedResponse
  const vector = data.embeddings?.[0]
  if (!vector || vector.length === 0) {
    throw new Error('Gömme (embedding) hesaplanamadı: sunucudan boş sonuç geldi.')
  }
  return new Float32Array(vector)
}
