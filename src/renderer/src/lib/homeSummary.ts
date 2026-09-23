import type { Reminder, Task } from '@shared/api'
import { toIsoDate } from './dates'

interface SummaryInput {
  tasks: Task[]
  reminders: Reminder[]
  now: Date
}

export interface TodaySummary {
  /** Bugün ya da daha önce vadesi gelmiş, tamamlanmamış görevler */
  dueTasks: number
  /** Bunlardan vadesi geçenler */
  overdue: number
  /** Bugün henüz çalmamış hatırlatmalar */
  reminders: number
  /** Bugünün en yakın saatli işi */
  next: { time: string; label: string } | null
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Bugünün sayıları ve sıradaki saatli iş; Ana Sayfa cümlesi ve parçaları bundan beslenir */
export function summarizeToday({ tasks, reminders, now }: SummaryInput): TodaySummary {
  const today = toIsoDate(now)
  const nowTime = hhmm(now)

  const openTasks = tasks.filter((task) => task.doneAt === null && task.dueDate !== null)
  const dueTasks = openTasks.filter((task) => task.dueDate! <= today)
  const overdue = dueTasks.filter((task) => task.dueDate! < today).length

  const upcomingReminders = reminders.filter(
    (reminder) =>
      reminder.sentAt === null &&
      reminder.remindAt >= now.getTime() &&
      toIsoDate(new Date(reminder.remindAt)) === today
  )

  const timed: { time: string; label: string }[] = [
    ...dueTasks
      .filter((task) => task.dueDate === today && task.dueTime !== null && task.dueTime > nowTime)
      .map((task) => ({ time: task.dueTime!, label: task.title })),
    ...upcomingReminders.map((reminder) => ({
      time: hhmm(new Date(reminder.remindAt)),
      label: reminder.message
    }))
  ].sort((a, b) => a.time.localeCompare(b.time))

  return {
    dueTasks: dueTasks.length,
    overdue,
    reminders: upcomingReminders.length,
    next: timed[0] ?? null
  }
}

/** Ana Sayfa'daki tek cümlelik bağlam özeti: bugünün görev ve hatırlatmaları, sıradaki saatli iş */
export function buildHomeSummary(input: SummaryInput): string {
  const { dueTasks, overdue, reminders, next } = summarizeToday(input)

  if (dueTasks === 0 && reminders === 0) return 'Bugün önünde acil bir iş yok.'

  const parts: string[] = []
  if (dueTasks > 0) parts.push(`${dueTasks} görevin`)
  if (reminders > 0) parts.push(`${reminders} hatırlatman`)

  let sentence = `Bugün ${parts.join(' ve ')} var.`
  if (overdue > 0) sentence += ` ${overdue} tanesi gecikti.`
  if (next) sentence += ` Sıradaki: ${next.time} ${next.label}.`
  return sentence
}
