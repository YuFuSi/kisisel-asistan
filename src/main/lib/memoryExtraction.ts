import { splitAttachments } from '../../shared/attachments'
import type { MemoryKind } from '../../shared/api'

// Hafıza işleyicinin saf kısmı: sohbeti modele verilecek metne çevirme, modelden gelen JSON'u
// ayrıştırıp doğrulama ve asla kaydedilmemesi gereken hassas bilgiyi eleme. Electron/model
// çağrısı yok; ai/memoryProcessor.ts kullanır.

export interface ExtractedFact {
  kind: MemoryKind
  content: string
}

export interface Extraction {
  summary: string
  facts: ExtractedFact[]
}

export interface TranscriptMessage {
  role: 'user' | 'assistant'
  content: string
}

// Yerel modelin bağlamını taşırmamak için sohbetin en yeni kısmı bu kadar karakterle sınırlanır
const TRANSCRIPT_LIMIT = 12_000
const SUMMARY_LIMIT = 600
const FACT_LIMIT = 300
const MAX_FACTS = 10

const KINDS: Record<string, MemoryKind> = {
  profil: 'profil',
  bilgi: 'bilgi',
  tercih: 'tercih',
  kisi: 'kisi',
  kişi: 'kisi',
  olay: 'olay',
  plan: 'plan'
}

/** Mesajları "Kullanıcı: ... / Pıtır: ..." metnine çevirir; eklenen belge içerikleri atılır */
export function formatTranscript(messages: TranscriptMessage[]): string {
  const lines = messages.map((message) => {
    const { text, documents } = splitAttachments(message.content)
    const note = documents.length > 0 ? ` [${documents.length} belge eklendi]` : ''
    const who = message.role === 'user' ? 'Kullanıcı' : 'Pıtır'
    return `${who}: ${text.trim()}${note}`
  })
  const full = lines.join('\n')
  // Uzunsa en yeni kısım kalır (özet ve bilgiler güncel konuşmadan çıkarılsın)
  return full.length > TRANSCRIPT_LIMIT ? `…${full.slice(-TRANSCRIPT_LIMIT)}` : full
}

export const EXTRACTION_INSTRUCTIONS = [
  'Sen Pıtır adlı kişisel asistanın hafıza bölümüsün. Sana kullanıcı ile Pıtır arasındaki bir konuşma verilecek.',
  'Görevin: (1) konuşmanın 1-3 cümlelik Türkçe özetini yazmak, (2) kullanıcı hakkında ileride işe yarayacak kalıcı bilgileri çıkarmak.',
  "Sadece KULLANICININ söylediği veya açıkça onayladığı bilgileri çıkar; Pıtır'ın önerilerini veya genel bilgileri çıkarma.",
  'Her bilgi kısa, tek başına anlaşılır bir cümle olsun ve "Kullanıcı ..." diye başlasın (ör. "Kullanıcının kızının adı Elif.").',
  'Türler: profil (adı, işi, yaşadığı yer gibi temel kimlik), tercih (sevdiği/sevmediği, nasıl çalıştığı), kisi (hayatındaki insanlar), olay (yaşanan önemli şey, tarihiyle), plan (niyet, hedef, yapılacak büyük iş), bilgi (diğer).',
  'Göreli zamanları (yarın, Cuma, gelecek hafta) konuşmanın tarihine göre gerçek tarihe çevir (ör. "2 Ekim 2026 Cuma").',
  'Zaten bilinen bilgileri tekrar yazma. Kalıcı bilgi yoksa "bilgiler" boş liste olsun.',
  'ASLA şifre, parola, kart/hesap/IBAN numarası, kimlik numarası, API anahtarı veya benzeri gizli bilgi yazma.',
  'Cevabın SADECE şu biçimde bir JSON olsun, başka hiçbir şey yazma:',
  '{"ozet": "...", "bilgiler": [{"tur": "tercih", "metin": "Kullanıcı ..."}]}'
].join('\n')

/** Modele verilecek istek: bilinenler + (varsa) önceki özet + yeni konuşma */
export function buildExtractionPrompt(
  transcript: string,
  known: string[],
  previousSummary: string | null,
  conversationDate?: Date
): string {
  const parts: string[] = []
  if (conversationDate) {
    const date = conversationDate.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    })
    parts.push(`Konuşmanın tarihi: ${date}`, '')
  }
  if (known.length > 0) {
    parts.push('Zaten bilinenler (tekrar yazma):', ...known.slice(0, 40).map((k) => `- ${k}`), '')
  }
  if (previousSummary) {
    parts.push(
      'Bu konuşmanın önceki kısmının özeti (yeni özet bunu da kapsasın):',
      previousSummary,
      ''
    )
  }
  parts.push('Konuşma:', transcript)
  return parts.join('\n')
}

// Asla hafızaya girmemesi gereken bilgiler: model talimata uymasa bile burada elenir
const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:\d[ -]?){13,19}\b/, // kart numarası
  /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i, // IBAN
  /\b[1-9]\d{10}\b/, // TC kimlik numarası (11 hane)
  /\b(?:sk|pk|rk|gsk|ghp|xox[bap])[-_][A-Za-z0-9_-]{12,}/, // API anahtarı biçimleri
  // Şifre/anahtar kelimesinden sonra bir değer verilmişse (": x", "= x" veya tırnak içinde)
  /(şifre|parola|password|pin|api anahtar|token)\S*\s*[:=]\s*\S{3,}/i,
  /(şifre|parola|password|pin|api anahtar|token)\S*(\s+\S+){0,2}\s*["'“‘][^"'”’]{3,}["'”’]/i
]

export function isSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
}

function clip(text: string, limit: number): string {
  const value = text.replace(/\s+/g, ' ').trim()
  return value.length > limit ? `${value.slice(0, limit - 1).trim()}…` : value
}

/**
 * Modelin ham cevabından özet ve bilgileri çıkarır. JSON bulunamaz veya biçim bozuksa null döner
 * (çağıran o turu atlar, veri bozulmaz). Hassas bilgi içeren ve bilinmeyen biçimli bilgiler atılır.
 */
export function parseExtraction(raw: string): Extraction | null {
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/```(?:json)?/gi, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  const rawSummary = record.ozet ?? record.summary
  const summary =
    typeof rawSummary === 'string' && !isSensitive(rawSummary)
      ? clip(rawSummary, SUMMARY_LIMIT)
      : ''

  const rawFacts = record.bilgiler ?? record.facts
  const facts: ExtractedFact[] = []
  const seen = new Set<string>()
  if (Array.isArray(rawFacts)) {
    for (const item of rawFacts) {
      if (facts.length >= MAX_FACTS) break
      const fact = item as Record<string, unknown> | string | null
      const content =
        typeof fact === 'string'
          ? fact
          : typeof fact?.metin === 'string'
            ? fact.metin
            : typeof fact?.content === 'string'
              ? fact.content
              : ''
      const cleaned = clip(content, FACT_LIMIT)
      if (cleaned.length < 6 || isSensitive(cleaned)) continue
      const key = cleaned.toLocaleLowerCase('tr-TR')
      if (seen.has(key)) continue
      seen.add(key)
      const kindName =
        typeof fact === 'object' && fact && typeof fact.tur === 'string'
          ? fact.tur.toLocaleLowerCase('tr-TR').trim()
          : ''
      facts.push({ kind: KINDS[kindName] ?? 'bilgi', content: cleaned })
    }
  }

  if (!summary && facts.length === 0 && rawSummary === undefined && rawFacts === undefined) {
    return null
  }
  return { summary, facts }
}
