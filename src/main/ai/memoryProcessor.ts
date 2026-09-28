import { generateText } from 'ai'
import { listMessages } from '../data/conversations'
import { getDigest, markDigestProcessed, setDigestEmbedding, upsertDigest } from '../data/digests'
import {
  insertMemory,
  listMemoriesWithEmbeddings,
  setMemoryEmbedding,
  updateMemory
} from '../data/memories'
import { notifyDataChanged } from '../events'
import { cosineSimilarity } from '../lib/cosine'
import { floatsToBlob } from '../lib/embeddingBlob'
import {
  buildExtractionPrompt,
  EXTRACTION_INSTRUCTIONS,
  formatTranscript,
  parseExtraction,
  type ExtractedFact
} from '../lib/memoryExtraction'
import { findSimilarMemory } from '../lib/memoryRank'
import { embedText } from './embeddings'
import { getLocalModel } from './providers'

// Hafıza işleyici: bitmiş bir sohbetten (veya sohbetin yeni kısmından) özet ve kalıcı bilgileri
// yerel modelle çıkarır; bilgileri tekilleştirerek hafızaya, özeti konuşma hafızasına yazar.
// Kullanıcı kararı: her zaman yerel model (kişisel bilgi buluta gitmez).

// Anlam benzerliği bu eşiği geçen bilgi yeni kayıt açmaz, mevcut kaydı günceller
const DUPLICATE_SIMILARITY = 0.85
// Bunun üstündeyse bilgi zaten aynı; güncelleme bile gerekmez
const SAME_SIMILARITY = 0.95
// Model art arda bu kadar çıkarılamaz cevap verirse o kısım atlanır (sonsuz yeniden deneme olmasın)
const MAX_PARSE_FAILURES = 3

const parseFailures = new Map<number, number>()

// SQLite datetime('now') UTC ve işaretsiz ("2026-09-28 10:00:00"); yerel saat sanılmasın
function parseSqliteUtc(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

export interface ProcessResult {
  added: number
  updated: number
  summarized: boolean
}

async function tryEmbed(text: string): Promise<Float32Array | null> {
  try {
    return await embedText(text)
  } catch {
    // Ollama'da bge-m3 yoksa/erişilemezse kök benzerliğine düşülür; embedding sonra doldurulur
    return null
  }
}

/** Bilgiyi hafızaya yazar: çok benzer kayıt varsa günceller, aynısıysa dokunmaz */
async function storeFact(
  fact: ExtractedFact,
  conversationId: number
): Promise<'added' | 'updated' | 'same'> {
  const existing = listMemoriesWithEmbeddings()
  const vector = await tryEmbed(fact.content)

  if (vector) {
    let best: { id: number; score: number } | null = null
    for (const memory of existing) {
      // Eski kayıtların (ör. anlamsal arama kapalıyken yazılanlar) embedding'i olmayabilir;
      // karşılaştırılamazsa aynı bilgi ikinci kez eklenirdi. Bir kez hesaplanıp saklanır.
      let embedding = memory.embedding
      if (!embedding) {
        embedding = await tryEmbed(memory.content)
        if (!embedding) continue
        setMemoryEmbedding(memory.id, floatsToBlob(embedding))
      }
      const score = cosineSimilarity(vector, embedding)
      if (!best || score > best.score) best = { id: memory.id, score }
    }
    if (best && best.score >= SAME_SIMILARITY) return 'same'
    if (best && best.score >= DUPLICATE_SIMILARITY) {
      updateMemory(best.id, fact.content)
      setMemoryEmbedding(best.id, floatsToBlob(vector))
      return 'updated'
    }
  } else {
    const similar = findSimilarMemory(existing, fact.content)
    if (similar) {
      if (similar.content === fact.content) return 'same'
      updateMemory(similar.id, fact.content)
      return 'updated'
    }
  }

  const memory = insertMemory(fact.content, {
    kind: fact.kind,
    source: 'otomatik',
    sourceConversationId: conversationId
  })
  if (vector) setMemoryEmbedding(memory.id, floatsToBlob(vector))
  return 'added'
}

/**
 * Sohbetin henüz işlenmemiş mesajlarını işler. Model veya Ollama hata verirse hata fırlatır
 * (zamanlayıcı sonra yeniden dener); modelin cevabı ayrıştırılamazsa birkaç denemeden sonra o
 * kısım işlendi sayılır.
 */
export async function processConversation(conversationId: number): Promise<ProcessResult> {
  const messages = listMessages(conversationId)
  const digest = getDigest(conversationId)
  const processedUntil = digest?.processedUntil ?? 0
  const fresh = messages.filter((message) => message.id > processedUntil)
  const result: ProcessResult = { added: 0, updated: 0, summarized: false }
  if (fresh.length === 0) return result
  const lastId = fresh[fresh.length - 1].id

  const known = listMemoriesWithEmbeddings().map((memory) => memory.content)
  const prompt = buildExtractionPrompt(
    formatTranscript(fresh),
    known,
    digest?.summary ?? null,
    parseSqliteUtc(fresh[fresh.length - 1].createdAt)
  )
  const { text } = await generateText({
    model: getLocalModel(),
    instructions: EXTRACTION_INSTRUCTIONS,
    prompt,
    temperature: 0.2
  })

  const extraction = parseExtraction(text)
  if (!extraction) {
    const failures = (parseFailures.get(conversationId) ?? 0) + 1
    parseFailures.set(conversationId, failures)
    console.warn(
      `Hafıza işleyici: sohbet ${conversationId} cevabı ayrıştırılamadı (${failures}. deneme)`
    )
    if (failures >= MAX_PARSE_FAILURES) {
      parseFailures.delete(conversationId)
      if (digest) markDigestProcessed(conversationId, lastId)
      else
        upsertDigest({
          conversationId,
          summary: '',
          processedUntil: lastId,
          startedAt: messages[0].createdAt,
          endedAt: messages[messages.length - 1].createdAt
        })
    }
    return result
  }
  parseFailures.delete(conversationId)

  for (const fact of extraction.facts) {
    const outcome = await storeFact(fact, conversationId)
    if (outcome === 'added') result.added++
    else if (outcome === 'updated') result.updated++
  }

  const summary = extraction.summary || digest?.summary || ''
  upsertDigest({
    conversationId,
    summary,
    processedUntil: lastId,
    startedAt: messages[0].createdAt,
    endedAt: messages[messages.length - 1].createdAt
  })
  result.summarized = summary.length > 0
  if (summary) {
    const vector = await tryEmbed(summary)
    if (vector) setDigestEmbedding(conversationId, floatsToBlob(vector))
  }

  if (result.added > 0 || result.updated > 0) notifyDataChanged('memories')
  return result
}
