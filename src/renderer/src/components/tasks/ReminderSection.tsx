import { useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'
import type { Reminder } from '@shared/api'
import { formatReminderTime } from '../../lib/dates'
import {
  compactInputClass,
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  sectionTitleClass
} from '../../lib/styles'

interface ReminderSectionProps {
  reminders: Reminder[] | null
  /** Başarılı olursa true döner; o zaman form temizlenir */
  onCreate: (message: string, remindAt: number) => Promise<boolean>
  onDelete: (id: number) => void
}

function ReminderSection({
  reminders,
  onCreate,
  onDelete
}: ReminderSectionProps): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [when, setWhen] = useState('')
  const canSubmit = message.trim() !== '' && when !== ''

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return
    // datetime-local değeri ("2026-09-12T10:00") yerel saat olarak okunur
    if (await onCreate(message.trim(), new Date(when).getTime())) {
      setMessage('')
      setWhen('')
    }
  }

  return (
    <section className="space-y-3">
      <h2 className={sectionTitleClass}>Hatırlatmalar</h2>

      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Neyi hatırlatayım?"
          className={inputClass}
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Hatırlatma zamanı"
          className={`${compactInputClass} w-56`}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className={`${primaryButtonClass} inline-flex items-center gap-1.5`}
        >
          <Plus className="h-4 w-4" />
          Kur
        </button>
      </form>

      {reminders && reminders.length === 0 && (
        <p className="px-1 py-2 text-sm text-zinc-500">Bekleyen hatırlatma yok.</p>
      )}
      <ul className="space-y-1">
        {reminders?.map((reminder) => (
          <li
            key={reminder.id}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-900"
          >
            <Bell className="h-4 w-4 shrink-0 text-violet-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {reminder.message}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">
              {formatReminderTime(reminder.remindAt)}
            </span>
            <button
              onClick={() => onDelete(reminder.id)}
              aria-label="Hatırlatmayı sil"
              title="Sil"
              className={`${iconButtonClass} hover:text-red-400`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ReminderSection
