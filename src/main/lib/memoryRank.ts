// Hafıza kayıtlarını benzerlik ve alakaya göre işleyen yardımcılar. electron import etmez.

import { cosineSimilarity } from './cosine'

interface MemoryLike {
  id: number
  content: string
}

// Anlam taşımayan sık kelimeler karşılaştırmaya katılmaz
const STOP_WORDS = new Set([
  've',
  'ile',
  'bir',
  'bu',
  'şu',
  'için',
  'gibi',
  'çok',
  'daha',
  'ama',
  'veya',
  'da',
  'de',
  'mi',
  'mı',
  'mu',
  'mü',
  'ben',
  'sen',
  'benim',
  'senin',
  'onun',
  'kullanıcı',
  'kullanıcının',
  'olan',
  'olarak',
  'her',
  'hep',
  'en',
  'ne',
  'nasıl',
  'var',
  'yok',
  'the',
  'and'
])

// Türkçe ekleri kabaca atmak için kelimenin ilk 5 harfi kullanılır ("kahvesini" → "kahve")
const STEM_LENGTH = 5

/** Metni karşılaştırılabilir kelime köklerine ayırır */
export function memoryStems(text: string): Set<string> {
  const words = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  return new Set(words.map((word) => word.slice(0, STEM_LENGTH)))
}

/** İki metnin kelime köklerine göre benzerliği (0-1, Jaccard) */
export function memorySimilarity(a: string, b: string): number {
  const first = memoryStems(a)
  const second = memoryStems(b)
  if (first.size === 0 || second.size === 0) return 0
  let shared = 0
  for (const stem of first) if (second.has(stem)) shared++
  return shared / (first.size + second.size - shared)
}

/** Aynı bilgiyi anlatan (çok benzer) kaydı bulur; yoksa undefined */
export function findSimilarMemory<T extends MemoryLike>(
  memories: T[],
  content: string,
  threshold = 0.6
): T | undefined {
  let best: T | undefined
  let bestScore = threshold
  for (const memory of memories) {
    const score = memorySimilarity(memory.content, content)
    if (score >= bestScore) {
      best = memory
      bestScore = score
    }
  }
  return best
}

/**
 * Kayıt sayısı sınırı aşıyorsa, son kullanıcı mesajıyla ortak kelimesi olanları öne alıp
 * kalanları en yeniden eskiye doldurur. Sınırın altındaysa hepsini döndürür.
 */
export function rankMemories<T extends MemoryLike>(
  memories: T[],
  query: string,
  limit: number
): T[] {
  if (memories.length <= limit) return memories
  const queryStems = memoryStems(query)
  const scored = memories.map((memory) => {
    let score = 0
    for (const stem of memoryStems(memory.content)) if (queryStems.has(stem)) score++
    return { memory, score }
  })
  scored.sort((a, b) => b.score - a.score || b.memory.id - a.memory.id)
  return scored.slice(0, limit).map((item) => item.memory)
}

interface MemoryLikeWithEmbedding extends MemoryLike {
  embedding: Float32Array | null
}

/**
 * rankMemories'in anlamsal (embedding) karşılığı: kayıt sayısı sınırı aşıyorsa, sorgu vektörüne
 * kosinüs benzerliği en yüksek kayıtları öne alır. Embedding'i olmayan (henüz indekslenmemiş)
 * kayıtlar en sona düşer, tamamen dışarıda bırakılmaz.
 */
export function rankMemoriesBySimilarity<T extends MemoryLikeWithEmbedding>(
  memories: T[],
  queryEmbedding: Float32Array,
  limit: number
): T[] {
  if (memories.length <= limit) return memories
  const scored = memories.map((memory) => ({
    memory,
    score: memory.embedding ? cosineSimilarity(memory.embedding, queryEmbedding) : -Infinity
  }))
  scored.sort((a, b) => b.score - a.score || b.memory.id - a.memory.id)
  return scored.slice(0, limit).map((item) => item.memory)
}
