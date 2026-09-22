import type { Reminder, Task } from '@shared/api'
import { toIsoDate } from './dates'

export type TimelineKind = 'task' | 'reminder'

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
  now: Date
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Sidebar'daki "Bugün" çizelgesi: saatli görevler ve bugünün hatırlatmaları, saate göre sıralı.
 * Saatsiz görevler (sadece tarihi olanlar) günün başına, 00:00 kabul edilerek eklenir.
 */
export function buildTimeline({ tasks, reminders, now }: TimelineInput): TimelineItem[] {
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

  return [...taskItems, ...reminderItems].sort((a, b) => a.time.localeCompare(b.time))
}

/** Çizelgede "şimdi" çizgisinin altına girecek ilk öğenin index'i (hepsi geçtiyse dizi uzunluğu) */
export function nowIndex(items: TimelineItem[], now: Date): number {
  const nowTime = hhmm(now)
  return items.findIndex((item) => item.time >= nowTime && !item.done)
}
