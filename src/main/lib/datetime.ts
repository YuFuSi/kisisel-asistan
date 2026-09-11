const pad = (n: number): string => String(n).padStart(2, '0')

/** Yerel tarih: 2026-09-11 */
export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Yerel tarih ve saat: 2026-09-11T21:30 */
export function toLocalIso(date: Date): string {
  return `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * "2026-09-12T10:00", "2026-09-12 10:00" veya saniyeli halini yerel saat olarak okur.
 * Geçersiz veya taşan değerlerde (31 Şubat, 25:00) null döner.
 */
export function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  return valid ? date : null
}

/** "2026-09-12" (veya bununla başlayan bir zaman) → "2026-09-12". Geçersizse null. */
export function parseLocalDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? toLocalDate(date) : null
}

/** "12 Eylül Cumartesi 10:00" */
export function formatDateTimeTr(date: Date): string {
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}
