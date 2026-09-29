import { parseClockTime } from './brief'

/**
 * Şu an sessiz saatlerde mi? Aralık gece yarısını aşabilir (22:00-08:00): başlangıç dahil, bitiş
 * hariç. Başlangıç ile bitiş aynıysa veya saatler geçersizse sessiz saat yok sayılır.
 */
export function isQuietTime(now: Date, start: string, end: string): boolean {
  const from = parseClockTime(start)
  const to = parseClockTime(end)
  if (from === null || to === null || from === to) return false
  const minute = now.getHours() * 60 + now.getMinutes()
  return from < to ? minute >= from && minute < to : minute >= from || minute < to
}
