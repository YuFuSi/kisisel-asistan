import { listMemoriesMissingEmbedding, setMemoryEmbedding } from '../data/memories'
import { getSettings } from '../settings'
import { embedText, floatsToBlob } from './embeddings'

/** Bir hafıza kaydının gömme vektörünü hesaplayıp veritabanına yazar. Ayar kapalıysa hiçbir şey yapmaz. */
export async function embedMemory(id: number, content: string): Promise<void> {
  if (!getSettings().semanticSearchEnabled) return
  const vector = await embedText(content)
  setMemoryEmbedding(id, floatsToBlob(vector))
}

/**
 * createMemory/updateMemory sonrası çağrılır. Embedding hesaplaması sohbeti veya arayüzü
 * bekletmesin diye arka planda (fire-and-forget) yapılır; hata olursa sadece günlüğe yazılır.
 */
export function scheduleMemoryEmbedding(id: number, content: string): void {
  void embedMemory(id, content).catch((err: unknown) => {
    console.error(`Hafıza kaydı ${id} için embedding hesaplanamadı:`, err)
  })
}

/**
 * Embedding'i eksik tüm hafıza kayıtlarını sırayla doldurur (Ollama'yı yormamak için art arda,
 * paralel değil). İşlenen kayıt sayısını döndürür.
 */
export async function backfillMemoryEmbeddings(): Promise<number> {
  const missing = listMemoriesMissingEmbedding()
  for (const memory of missing) {
    await embedMemory(memory.id, memory.content)
  }
  return missing.length
}
