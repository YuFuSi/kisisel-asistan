import { getConversation, searchConversations } from '../data/conversations'
import { getDigest, listDigestsWithEmbeddings } from '../data/digests'
import { cosineSimilarity } from '../lib/cosine'
import { embedText } from './embeddings'

// gecmiste_ara aracının arkası: geçmiş sohbetlerin özetlerinde anlamca, mesajlarda kelimeyle arar.

export interface PastConversationHit {
  tarih: string
  baslik: string
  ozet: string | null
  /** Kelime eşleşmesi mesaj içindeyse kısa alıntı */
  alinti: string | null
}

const RESULT_LIMIT = 5
const MIN_SIMILARITY = 0.4

function dateText(value: string): string {
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function searchPastConversations(query: string): Promise<PastConversationHit[]> {
  const scores = new Map<number, number>()
  const snippets = new Map<number, string | null>()

  // 1) Özetlerde anlam benzerliği (bge-m3 yoksa atlanır)
  try {
    const vector = await embedText(query)
    for (const digest of listDigestsWithEmbeddings()) {
      if (!digest.embedding || !digest.summary) continue
      const score = cosineSimilarity(vector, digest.embedding)
      if (score >= MIN_SIMILARITY) scores.set(digest.conversationId, score)
    }
  } catch {
    // Anlamsal arama kullanılamıyor; kelime aramasıyla devam
  }

  // 2) Başlık ve mesajlarda kelime araması (kelime eşleşmesi güçlü sinyal sayılır)
  for (const result of searchConversations(query)) {
    const id = result.conversation.id
    scores.set(id, Math.max(scores.get(id) ?? 0, 0.6))
    snippets.set(id, result.snippet)
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, RESULT_LIMIT)
    .flatMap(([id]) => {
      const conversation = getConversation(id)
      if (!conversation) return []
      const digest = getDigest(id)
      return [
        {
          tarih: dateText(digest?.endedAt ?? conversation.updatedAt),
          baslik: conversation.title || 'Başlıksız sohbet',
          ozet: digest?.summary || null,
          alinti: snippets.get(id) ?? null
        }
      ]
    })
}
