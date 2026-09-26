// Hafıza haritası için vektör benzerliği hesaplama.
// main sürecin lib/cosine.ts'i ile aynı mantık; renderer'a electron olmadan taşınabilir küçük
// bir saf fonksiyon olduğu için burada ayrıca tanımlı (import sınırları main/renderer arasında
// paylaşım yapmıyor).

/**
 * İki vektör arasındaki kosinüs benzerliğini hesaplar.
 * @param a Birinci vektör
 * @param b İkinci vektör
 * @returns -1 (zıt) ile 1 (aynı) arasında bir değer; sıfır vektörde 0
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
