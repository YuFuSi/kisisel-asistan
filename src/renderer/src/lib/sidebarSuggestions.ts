import type { Reminder, Task } from '@shared/api'
import { toIsoDate } from './dates'

export type SuggestionAction = { kind: 'open-tasks' } | { kind: 'ask'; prompt: string }

export interface Suggestion {
  id: string
  text: string
  action: SuggestionAction
}

interface SuggestionInput {
  tasks: Task[]
  reminders: Reminder[]
  now: Date
}

const STALE_DAYS = 3

/**
 * Pıtır'ın Ana Sayfa'ya değil, sidebar'a doğrudan çıkardığı öneriler: geciken görevler ve
 * yaklaşan saatli işler için tek tıkla harekete geçilebilen kısa cümleler. En fazla 2 öneri döner,
 * en önemlisi (gecikme) önce gelir; kalabalık etmesin diye kapsam kasıtlı dar tutulur.
 */
export function buildSuggestions({ tasks, reminders, now }: SuggestionInput): Suggestion[] {
  const today = toIsoDate(now)
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 86_400_000)
  const staleBeforeIso = toIsoDate(staleBefore)

  const suggestions: Suggestion[] = []

  const veryStale = tasks.filter(
    (task) => task.doneAt === null && task.dueDate !== null && task.dueDate <= staleBeforeIso
  )
  if (veryStale.length > 0) {
    suggestions.push({
      id: 'stale-tasks',
      text:
        veryStale.length === 1
          ? `"${veryStale[0].title}" ${STALE_DAYS}+ gündür bekliyor. Birlikte bakalım mı?`
          : `${veryStale.length} görev ${STALE_DAYS}+ gündür bekliyor. Birlikte planlayalım mı?`,
      action: { kind: 'open-tasks' }
    })
  }

  const overdueToday = tasks.filter(
    (task) => task.doneAt === null && task.dueDate !== null && task.dueDate < today
  ).length
  if (overdueToday > 0 && veryStale.length === 0) {
    suggestions.push({
      id: 'overdue-tasks',
      text: `${overdueToday} görevin vadesi geçti. Yeni bir tarih verelim mi?`,
      action: { kind: 'open-tasks' }
    })
  }

  const upcomingReminder = reminders
    .filter((reminder) => reminder.sentAt === null && reminder.remindAt > now.getTime())
    .sort((a, b) => a.remindAt - b.remindAt)[0]
  if (upcomingReminder && suggestions.length < 2) {
    const minutesLeft = Math.round((upcomingReminder.remindAt - now.getTime()) / 60_000)
    if (minutesLeft > 0 && minutesLeft <= 30) {
      suggestions.push({
        id: 'upcoming-reminder',
        text: `${minutesLeft} dk sonra "${upcomingReminder.message}" hatırlatman var.`,
        action: { kind: 'ask', prompt: 'Bugün başka ne yapmam gerekiyor?' }
      })
    }
  }

  return suggestions.slice(0, 2)
}
