import { toIsoDate } from './dates'
import { REPEAT_LABELS, type CalendarItem, type Reminder, type Task } from '../../../shared/api'

export const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export interface DayCell {
  /** Yerel tarih, YYYY-MM-DD */
  iso: string
  day: number
  /** Gösterilen aya ait mi (önceki/sonraki ayın günleri soluk görünür) */
  inMonth: boolean
  today: boolean
}

/** Ayın takvim ızgarası: pazartesiyle başlayan 6 hafta (42 gün) */
export function monthGrid(year: number, month: number, today: Date): DayCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const todayIso = toIsoDate(today)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i)
    const iso = toIsoDate(date)
    return { iso, day: date.getDate(), inMonth: date.getMonth() === month, today: iso === todayIso }
  })
}

const parseIso = (iso: string, addDays = 0): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day + addDays)
}

/** "2026-09-12", "14:00" → o günün 14:00'ünün epoch ms değeri */
const taskDueTimeMs = (iso: string, dueTime: string): number => {
  const [hour, minute] = dueTime.split(':').map(Number)
  const date = parseIso(iso)
  date.setHours(hour, minute)
  return date.getTime()
}

/** Izgaranın kapsadığı zaman aralığı; bitiş hariç (takvim sorgusu için) */
export function gridRange(cells: DayCell[]): { from: Date; to: Date } {
  return { from: parseIso(cells[0].iso), to: parseIso(cells[cells.length - 1].iso, 1) }
}

export type AgendaKind = 'event' | 'reminder' | 'task'

export interface AgendaEntry {
  key: string
  kind: AgendaKind
  title: string
  /** Epoch ms; tüm gün etkinliklerde ve görevlerde null */
  time: number | null
  end: number | null
  /** Konum veya tekrar bilgisi */
  detail: string | null
  /** Sadece görevlerde: görevin numarası ve tamamlanıp tamamlanmadığı */
  taskId: number | null
  done: boolean
}

/** Etkinlik bu güne denk geliyor mu (birden çok güne yayılan etkinlikler dahil) */
function coversDay(event: CalendarItem, iso: string): boolean {
  const dayStart = parseIso(iso).getTime()
  const dayEnd = parseIso(iso, 1).getTime()
  const end = event.end !== null && event.end > event.start ? event.end : event.start + 1
  return event.start < dayEnd && end > dayStart
}

/** Bir günün programı: önce tüm gün olanlar ve görevler, sonra saat sırasıyla */
export function buildAgenda(
  iso: string,
  events: CalendarItem[],
  reminders: Reminder[],
  tasks: Task[]
): AgendaEntry[] {
  const entries: AgendaEntry[] = []
  for (const event of events) {
    if (!coversDay(event, iso)) continue
    entries.push({
      key: `event:${event.id}:${iso}`,
      kind: 'event',
      title: event.title,
      time: event.allDay ? null : event.start,
      end: event.allDay ? null : event.end,
      detail: event.location,
      taskId: null,
      done: false
    })
  }
  for (const reminder of reminders) {
    if (toIsoDate(new Date(reminder.remindAt)) !== iso) continue
    entries.push({
      key: `reminder:${reminder.id}`,
      kind: 'reminder',
      title: reminder.message,
      time: reminder.remindAt,
      end: null,
      detail: reminder.repeat === 'none' ? null : REPEAT_LABELS[reminder.repeat],
      taskId: null,
      done: false
    })
  }
  for (const task of tasks) {
    if (task.dueDate !== iso) continue
    entries.push({
      key: `task:${task.id}`,
      kind: 'task',
      title: task.title,
      time: task.dueTime ? taskDueTimeMs(iso, task.dueTime) : null,
      end: null,
      detail: null,
      taskId: task.id,
      done: task.doneAt !== null
    })
  }
  return entries.sort((a, b) => (a.time ?? -1) - (b.time ?? -1))
}
