import type { CalendarItem, Reminder, Task } from '@shared/api'
import { toIsoDate } from './dates'

export type TimelineKind = 'task' | 'reminder' | 'event'

export interface TimelineItem {
  id: string
  kind: TimelineKind
  time: string
  label: string
  /** Görev tamamlandıysa ya da hatırlatma zaten çaldıysa */
  done: boolean
  /** Şimdiden önce ama tamamlanmamış (görevde: vadesi geçmiş) */
  overdue: boolean
}

interface TimelineInput {
  tasks: Task[]
  reminders: Reminder[]
  /** Google Takvim etkinlikleri; hesap bağlı değilse boş dizi verilir */
  events?: CalendarItem[]
  now: Date
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Sidebar'daki "Bugün" çizelgesi: saatli görevler ve bugünün hatırlatmaları, saate göre sıralı.
 * Saatsiz görevler (sadece tarihi olanlar) günün başına, 00:00 kabul edilerek eklenir.
 */
export function buildTimeline({
  tasks,
  reminders,
  events = [],
  now
}: TimelineInput): TimelineItem[] {
  const today = toIsoDate(now)
  const nowTime = hhmm(now)

  const taskItems: TimelineItem[] = tasks
    .filter((task) => task.dueDate === today)
    .map((task) => ({
      id: `task-${task.id}`,
      kind: 'task' as const,
      time: task.dueTime ?? '00:00',
      label: task.title,
      done: task.doneAt !== null,
      overdue: task.doneAt === null && task.dueTime !== null && task.dueTime < nowTime
    }))

  const reminderItems: TimelineItem[] = reminders
    .filter((reminder) => toIsoDate(new Date(reminder.remindAt)) === today)
    .map((reminder) => ({
      id: `reminder-${reminder.id}`,
      kind: 'reminder' as const,
      time: hhmm(new Date(reminder.remindAt)),
      label: reminder.message,
      done: reminder.sentAt !== null,
      overdue: reminder.sentAt === null && reminder.remindAt < now.getTime()
    }))

  // Tüm gün etkinlikleri saatsiz görev gibi 00:00'a, saatli etkinlikler kendi saatine gider.
  // "done" burada tamamlanma değil, etkinliğin bitmiş (geçmişte kalmış) olması anlamına gelir.
  const eventItems: TimelineItem[] = events
    .filter((event) => toIsoDate(new Date(event.start)) === today)
    .map((event) => ({
      id: `event-${event.id}`,
      kind: 'event' as const,
      time: event.allDay ? '00:00' : hhmm(new Date(event.start)),
      label: event.allDay ? `${event.title} (tüm gün)` : event.title,
      done: (event.end ?? event.start) < now.getTime(),
      overdue: false
    }))

  return [...taskItems, ...reminderItems, ...eventItems].sort((a, b) =>
    a.time.localeCompare(b.time)
  )
}

/** Çizelgede "şimdi" çizgisinin altına girecek ilk öğenin index'i (hepsi geçtiyse dizi uzunluğu) */
export function nowIndex(items: TimelineItem[], now: Date): number {
  const nowTime = hhmm(now)
  return items.findIndex((item) => item.time >= nowTime && !item.done)
}
