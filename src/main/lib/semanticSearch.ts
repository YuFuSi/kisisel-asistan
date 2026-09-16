// Embedding'e sahip herhangi bir kayıt listesini bir sorgu vektörüne göre sıralayan genel yardımcı.
// memoryRank.ts'teki rankMemoriesBySimilarity'den farkı: burada her zaman sıralanır (arama sonucu
// göstermek için), "sınırın altındaysa hepsini olduğu gibi döndür" kısayolu yok.

import { cosineSimilarity } from './cosine'

interface EmbeddableItem {
  id: number
  embedding: Float32Array | null
}

/**
 * Öğeleri sorgu vektörüne kosinüs benzerliğine göre en alakalıdan en alakasıza sıralar.
 * Embedding'i eksik öğeler dışlanmaz, en sona düşer.
 */
export function sortBySimilarity<T extends EmbeddableItem>(
  items: T[],
  queryEmbedding: Float32Array
): T[] {
  return [...items].sort((a, b) => {
    const scoreA = a.embedding ? cosineSimilarity(a.embedding, queryEmbedding) : -Infinity
    const scoreB = b.embedding ? cosineSimilarity(b.embedding, queryEmbedding) : -Infinity
    return scoreB - scoreA || b.id - a.id
  })
}
