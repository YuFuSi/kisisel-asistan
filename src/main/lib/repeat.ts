import { parseClockTime } from './brief'
import { parseLocalDateTime } from './datetime'
import type { RepeatRule } from '../../shared/api'

// Bir tekrarın en fazla kaç kez ileri atlayacağı. Uygulama uzun süre kapalı kalırsa
// sonsuz döngüye girmemek için sınır konur (yaklaşık 10 yıllık günlük tekrar).
const MAX_STEPS = 4000

const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6

/**
 * Tekrarlayan bir hatırlatmanın bir sonraki zamanını hesaplar.
 * Sonuç her zaman `now`dan sonradır; uygulama kapalıyken kaçırılan tekrarlar atlanır.
 * `none` için null döner (hatırlatma bir daha çalmaz).
 *
 * Gün eklemek için `setDate` kullanılır; böylece yaz saati geçişlerinde de saat sabit kalır.
 */
export function nextReminderTime(remindAt: number, repeat: RepeatRule, now: number): number | null {
  if (repeat === 'none') return null

  const date = new Date(remindAt)
  const step = repeat === 'weekly' ? 7 : 1

  for (let i = 0; i < MAX_STEPS; i++) {
    date.setDate(date.getDate() + step)
    if (repeat === 'weekdays' && isWeekend(date)) continue
    if (date.getTime() > now) return date.getTime()
  }
  return null
}

/**
 * Modelden gelen hatırlatma zamanını okur: tam tarih-saat ("2026-09-13T09:00") veya sadece saat ("09:00").
 * Sadece saat verilirse o saatin bir sonraki geleceği an kullanılır; hafta içi kuralında hafta sonu atlanır.
 * Küçük modeller "her gün 9'da" gibi isteklerde çoğu zaman sadece saati gönderiyor.
 */
export function resolveReminderTime(value: string, repeat: RepeatRule, now: number): Date | null {
  const full = parseLocalDateTime(value)
  if (full) return full

  const minutes = parseClockTime(value)
  if (minutes === null) return null
  const date = new Date(now)
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  while (date.getTime() <= now || (repeat === 'weekdays' && isWeekend(date))) {
    date.setDate(date.getDate() + 1)
  }
  return date
}

// Türkçe karakterleri ve ayraçları sadeleştirir: "Hafta_İçi" → "hafta ici"
export const simplify = (value: string): string =>
  value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[_-]+/g, ' ')
    .replace(/ +/g, ' ')
    .trim()

const REPEAT_ALIASES: Record<string, RepeatRule> = {
  '': 'none',
  none: 'none',
  yok: 'none',
  'tek seferlik': 'none',
  daily: 'daily',
  'her gun': 'daily',
  hergun: 'daily',
  gunluk: 'daily',
  weekdays: 'weekdays',
  'hafta ici': 'weekdays',
  'hafta ici her gun': 'weekdays',
  'is gunleri': 'weekdays',
  weekly: 'weekly',
  'her hafta': 'weekly',
  haftalik: 'weekly'
}

/**
 * Modelden gelen tekrar değerini kurala çevirir. Küçük modeller "her_gun", "Hafta içi" gibi
 * yazabildiği için Türkçe ve İngilizce yazımlar kabul edilir. Anlaşılmazsa hata verir.
 */
export function parseRepeatInput(value: string | undefined): RepeatRule {
  const rule = REPEAT_ALIASES[simplify(value ?? '')]
  if (!rule) {
    throw new Error(
      `Tekrar değeri anlaşılamadı: "${value}". Kullanılabilecekler: her_gun, hafta_ici, her_hafta.`
    )
  }
  return rule
}
