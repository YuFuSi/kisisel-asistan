import type { Reminder, Task } from '@shared/api'
import { toIsoDate } from './dates'

interface SummaryInput {
  tasks: Task[]
  reminders: Reminder[]
  now: Date
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Ana Sayfa'daki tek cümlelik bağlam özeti: bugünün görev ve hatırlatmaları, sıradaki saatli iş */
export function buildHomeSummary({ tasks, reminders, now }: SummaryInput): string {
  const today = toIsoDate(now)
  const nowTime = hhmm(now)

  const openTasks = tasks.filter((task) => task.doneAt === null && task.dueDate !== null)
  const dueTasks = openTasks.filter((task) => task.dueDate! <= today)
  const overdue = dueTasks.filter((task) => task.dueDate! < today).length

  // Bugün henüz çalmamış hatırlatmalar
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

  if (dueTasks.length === 0 && upcomingReminders.length === 0) {
    return 'Bugün önünde acil bir iş yok.'
  }

  const parts: string[] = []
  if (dueTasks.length > 0) parts.push(`${dueTasks.length} görevin`)
  if (upcomingReminders.length > 0) parts.push(`${upcomingReminders.length} hatırlatman`)

  let sentence = `Bugün ${parts.join(' ve ')} var.`
  if (overdue > 0) sentence += ` ${overdue} tanesi gecikti.`
  if (timed.length > 0) sentence += ` Sıradaki: ${timed[0].time} ${timed[0].label}.`
  return sentence
}
