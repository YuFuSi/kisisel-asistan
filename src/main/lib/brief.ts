import type { DailyBrief } from '../ai/brief'
import { toLocalDate } from './datetime'

/** "08:00" gibi saat metnini dakikaya çevirir; geçersizse null */
export function parseClockTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Sabah özeti bildirimi şimdi gösterilmeli mi?
 * Ayarlanan saat bugün geçtiyse ve bugün henüz gösterilmediyse evet.
 * Uygulama o saatte kapalıysa, gün içinde açıldığında bir kez gösterilir.
 */
export function isBriefDue(now: Date, time: string, lastShownDate: string | null): boolean {
  const target = parseClockTime(time)
  if (target === null) return false
  if (lastShownDate === toLocalDate(now)) return false
  return now.getHours() * 60 + now.getMinutes() >= target
}

export interface BriefCounts {
  tasks: number
  events: number | null
  unreadMails: number | null
  temperature: number | null
}

/** Bildirimde görünecek tek satırlık kısa özet */
export function briefNotificationText(counts: BriefCounts): string {
  const parts: string[] = [counts.tasks === 0 ? 'Bekleyen görev yok' : `${counts.tasks} görev`]
  if (counts.events !== null) parts.push(`${counts.events} etkinlik`)
  if (counts.unreadMails !== null) parts.push(`${counts.unreadMails} okunmamış e-posta`)
  if (counts.temperature !== null) parts.push(`${Math.round(counts.temperature)}°C`)
  return `${parts.join(' · ')}. Ayrıntılı özet için tıkla.`
}

/** Sabah özetini sesli okumak için doğal, kısa Türkçe cümlelere çevirir */
export function briefSpokenText(brief: DailyBrief): string {
  const parts: string[] = [`Günaydın! Bugün ${brief.tarih}.`]
  // Kişisel not (adınla, bugünün en önemli işi) sayılardan önce gelir
  if (brief.kisiselNot) parts.push(brief.kisiselNot)

  if (brief.hava) {
    parts.push(`Hava ${Math.round(brief.hava.sicaklik)} derece, ${brief.hava.durum}.`)
  }

  parts.push(
    brief.gorevler.length === 0
      ? 'Bekleyen görevin yok.'
      : `${brief.gorevler.length} bekleyen görevin var.`
  )

  if (brief.etkinlikler !== null) {
    parts.push(
      brief.etkinlikler.length === 0
        ? 'Bugün takvimde bir etkinlik yok.'
        : `Bugün ${brief.etkinlikler.length} etkinliğin var.`
    )
  }

  if (brief.okunmamisEposta !== null && brief.okunmamisEposta > 0) {
    parts.push(`${brief.okunmamisEposta} okunmamış e-postan var.`)
  }

  return parts.join(' ')
}
