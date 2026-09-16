import {
  listMemories,
  listMemoriesMissingEmbedding,
  listMemoriesWithEmbeddings,
  setMemoryEmbedding
} from '../data/memories'
import { floatsToBlob } from '../lib/embeddingBlob'
import { rankMemories, rankMemoriesBySimilarity } from '../lib/memoryRank'
import { getSettings } from '../settings'
import type { Memory } from '../../shared/api'
import { embedText } from './embeddings'

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

/**
 * Sohbete eklenecek hafıza kayıtlarını seçer. Anlamsal arama kapalıysa veya kayıtların bir kısmı
 * henüz indekslenmemişse (ya da sorgu embedding'i hesaplanamazsa) tutarlı davranış için doğrudan
 * anahtar kelime sıralamasına (rankMemories) düşülür — sohbet asla bu yüzden hata vermez.
 */
export async function rankMemoriesForChat(query: string, limit: number): Promise<Memory[]> {
  if (!getSettings().semanticSearchEnabled) {
    return rankMemories(listMemories(), query, limit)
  }

  const memories = listMemoriesWithEmbeddings()
  if (memories.length <= limit) return memories
  if (memories.some((memory) => memory.embedding === null)) {
    return rankMemories(memories, query, limit)
  }

  try {
    const queryEmbedding = await embedText(query)
    return rankMemoriesBySimilarity(memories, queryEmbedding, limit)
  } catch (err) {
    console.error('Anlamsal hafıza sıralaması başarısız, anahtar kelimeye düşülüyor:', err)
    return rankMemories(memories, query, limit)
  }
}
