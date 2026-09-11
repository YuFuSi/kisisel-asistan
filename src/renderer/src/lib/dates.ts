const pad = (n: number): string => String(n).padStart(2, '0')
const DAY_MS = 86_400_000

/** Yerel tarih: 2026-09-11 */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

// Bugüne göre gün farkı: dün -1, bugün 0, yarın 1
const dayDiff = (date: Date, now: Date): number =>
  Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS)

function relativeDay(date: Date, now: Date): string | null {
  const diff = dayDiff(date, now)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Yarın'
  if (diff === -1) return 'Dün'
  return null
}

export interface DueDateInfo {
  text: string
  overdue: boolean
  today: boolean
}

/** "2026-09-12" → { text: 'Yarın', ... } */
export function describeDueDate(isoDate: string): DueDateInfo {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const now = new Date()
  const diff = dayDiff(date, now)
  const text =
    relativeDay(date, now) ??
    date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
    })
  return { text, overdue: diff < 0, today: diff === 0 }
}

/** Epoch ms → "Yarın 10:00" veya "15 Eylül Sal 10:00" */
export function formatReminderTime(ms: number): string {
  const date = new Date(ms)
  const now = new Date()
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const day =
    relativeDay(date, now) ??
    date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })
  return `${day} ${time}`
}
