import { listDigestsWithEmbeddings, type DigestWithEmbedding } from '../data/digests'
import {
  listMemoriesWithEmbeddings,
  markMemoriesUsed,
  type MemoryWithEmbedding
} from '../data/memories'
import { cosineSimilarity } from '../lib/cosine'
import { rankMemories, rankMemoriesBySimilarity } from '../lib/memoryRank'
import type { Recall, RecalledEpisode } from '../lib/recallFormat'
import type { Memory } from '../../shared/api'
import { embedText } from './embeddings'

// Hatırlama: her mesajda hangi hafızaların ve geçmiş konuşmaların modele verileceğini seçer.
// Veri modelden bağımsız veritabanında olduğu için seçili model (Gemini, Qwen...) değişse de aynı
// Jarvis hatırlar. Anlamsal arama (bge-m3) kullanılamazsa anahtar kelime sıralamasına düşer.

// Profil kayıtları her zaman; bunların dışında konuya göre en fazla bu kadar bilgi
const PROFILE_LIMIT = 15
const RELEVANT_LIMIT = 12
// Az kayıt varsa hepsi verilir (sıralamaya gerek yok)
const SMALL_MEMORY_COUNT = 20
// Süreklilik için en son konuşmalar her zaman; ek olarak konuyla ilgili eski konuşmalar
const RECENT_EPISODES = 2
const RELATED_EPISODES = 2
const EPISODE_SIMILARITY = 0.5

const strip = (memory: MemoryWithEmbedding): Memory => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding, ...rest } = memory
  return rest
}

async function tryEmbed(text: string): Promise<Float32Array | null> {
  if (!text.trim()) return null
  try {
    return await embedText(text)
  } catch {
    return null
  }
}

function pickRelevant(
  others: MemoryWithEmbedding[],
  query: string,
  queryVector: Float32Array | null
): MemoryWithEmbedding[] {
  if (others.length <= RELEVANT_LIMIT) return others
  const allEmbedded = others.every((memory) => memory.embedding)
  if (queryVector && allEmbedded) {
    return rankMemoriesBySimilarity(others, queryVector, RELEVANT_LIMIT)
  }
  return rankMemories(others, query, RELEVANT_LIMIT)
}

function pickEpisodes(
  digests: DigestWithEmbedding[],
  queryVector: Float32Array | null
): RecalledEpisode[] {
  const usable = digests.filter((digest) => digest.summary)
  // listDigestsWithEmbeddings en yeniden eskiye sıralı
  const chosen = usable.slice(0, RECENT_EPISODES)
  if (queryVector) {
    const related = usable
      .slice(RECENT_EPISODES)
      .filter((digest) => digest.embedding)
      .map((digest) => ({ digest, score: cosineSimilarity(queryVector, digest.embedding!) }))
      .filter((item) => item.score >= EPISODE_SIMILARITY)
      .sort((a, b) => b.score - a.score)
      .slice(0, RELATED_EPISODES)
      .map((item) => item.digest)
    chosen.push(...related)
  }
  // Eskiden yeniye okunması daha doğal
  return chosen
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    .map((digest) => ({ summary: digest.summary, endedAt: digest.endedAt }))
}

/**
 * Mesaja göre hatırlanacakları seçer. `conversationId` verilirse o sohbetin kendi özeti hariç
 * tutulur (mesajları zaten modele gidiyor).
 */
export async function recallFor(query: string, conversationId?: number | null): Promise<Recall> {
  const memories = listMemoriesWithEmbeddings()
  const digests = listDigestsWithEmbeddings().filter(
    (digest) => digest.conversationId !== conversationId
  )
  const needsVector = memories.length > SMALL_MEMORY_COUNT || digests.length > RECENT_EPISODES
  const queryVector = needsVector ? await tryEmbed(query) : null

  const profile = memories.filter((memory) => memory.kind === 'profil').slice(0, PROFILE_LIMIT)
  const others = memories.filter((memory) => memory.kind !== 'profil')
  const relevant =
    memories.length <= SMALL_MEMORY_COUNT ? others : pickRelevant(others, query, queryVector)

  const recall: Recall = {
    profile: profile.map(strip),
    relevant: relevant.map(strip),
    episodes: pickEpisodes(digests, queryVector)
  }
  try {
    markMemoriesUsed([...recall.profile, ...recall.relevant].map((memory) => memory.id))
  } catch {
    // Kullanım zamanı sadece bilgi amaçlı; yazılamazsa sohbet etkilenmesin
  }
  return recall
}
