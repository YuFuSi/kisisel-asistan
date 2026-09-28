import type { Memory } from '../../shared/api'

// Hatırlanan bilgileri sohbet talimatına eklenecek metne çevirir (saf fonksiyon, testli).

export interface RecalledEpisode {
  summary: string
  /** SQLite UTC zaman damgası ("2026-09-25 21:08:11") */
  endedAt: string
}

export interface Recall {
  profile: Memory[]
  relevant: Memory[]
  episodes: RecalledEpisode[]
}

// SQLite datetime('now') UTC ve işaretsiz; yerel saat sanılmasın
function parseUtc(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function dayText(value: string, now: Date): string {
  const date = parseUtc(value)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric'
  })
}

// Olay ve plan zamana bağlıdır ("Cuma günü", "yarın"); ne zaman öğrenildiği bilinmezse yanlış
// anlaşılır. Bu yüzden yanına öğrenildiği gün eklenir.
function memoryLine(memory: Memory, now: Date): string {
  if (memory.kind === 'olay' || memory.kind === 'plan') {
    const day = dayText(memory.createdAt, now)
    if (day) return `- [${day} tarihinde öğrenildi] ${memory.content}`
  }
  return `- ${memory.content}`
}

/** Talimata eklenecek satırlar; hatırlanacak bir şey yoksa boş dizi */
export function formatRecall(recall: Recall, now: Date): string[] {
  const lines: string[] = []
  const memories = [...recall.profile, ...recall.relevant]
  if (memories.length > 0) {
    lines.push('', 'Kullanıcı hakkında bildiklerin (hafıza):')
    lines.push(...memories.map((memory) => memoryLine(memory, now)))
  }
  if (recall.episodes.length > 0) {
    lines.push(
      '',
      'Kullanıcıyla daha önceki konuşmalarından hatırladıkların (başka sohbetler, başka modellerle olabilir):'
    )
    lines.push(
      ...recall.episodes.map((episode) => `- ${dayText(episode.endedAt, now)}: ${episode.summary}`)
    )
    lines.push(
      'Bu bilgileri gerektiğinde doğal şekilde kullan; kullanıcı "geçen sefer", "daha önce" gibi bir şey sorarsa buradan veya gecmiste_ara aracıyla cevapla. "Hatırlamıyorum" demeden önce gecmiste_ara ile bak.'
    )
  }
  return lines
}
