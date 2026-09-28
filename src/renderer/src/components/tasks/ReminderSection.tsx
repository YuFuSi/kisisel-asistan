import { useState } from 'react'
import { Bell, Clock, Plus, Repeat, Trash2 } from 'lucide-react'
import { REPEAT_LABELS, type Reminder, type RepeatRule } from '@shared/api'
import { formatReminderTime } from '../../lib/dates'
import {
  compactInputClass,
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  quietIconButtonClass,
  sectionTitleClass
} from '../../lib/styles'

interface ReminderSectionProps {
  reminders: Reminder[] | null
  /** Başarılı olursa true döner; o zaman form temizlenir */
  onCreate: (message: string, remindAt: number, repeat: RepeatRule) => Promise<boolean>
  onDelete: (id: number) => void
  onSnooze: (id: number, minutes: number) => void
}

// "Ertele" düğmesinin seçenekleri
const SNOOZE_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 10, label: '10 dakika' },
  { minutes: 60, label: '1 saat' },
  { minutes: 60 * 24, label: 'Yarın aynı saat' }
]

const REPEAT_OPTIONS = Object.entries(REPEAT_LABELS) as [RepeatRule, string][]

function ReminderSection({
  reminders,
  onCreate,
  onDelete,
  onSnooze
}: ReminderSectionProps): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [when, setWhen] = useState('')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  // Erteleme seçenekleri açık olan hatırlatma
  const [snoozing, setSnoozing] = useState<number | null>(null)
  const canSubmit = message.trim() !== '' && when !== ''

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return
    // datetime-local değeri ("2026-09-12T10:00") yerel saat olarak okunur
    if (await onCreate(message.trim(), new Date(when).getTime(), repeat)) {
      setMessage('')
      setWhen('')
      setRepeat('none')
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
        <select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatRule)}
          aria-label="Tekrar"
          className={`${compactInputClass} w-36`}
        >
          {REPEAT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          Kur
        </button>
      </form>

      {reminders && reminders.length === 0 && (
        <p className="px-1 py-2 text-sm text-faint">Bekleyen hatırlatma yok.</p>
      )}
      <ul className="space-y-1">
        {reminders?.map((reminder) => (
          <li key={reminder.id} className="group rounded-lg px-3 py-2.5 hover:bg-surface">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{reminder.message}</span>
              {reminder.repeat !== 'none' && (
                <span
                  title={REPEAT_LABELS[reminder.repeat]}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted"
                >
                  <Repeat className="h-3 w-3" />
                  {REPEAT_LABELS[reminder.repeat]}
                </span>
              )}
              <span className="shrink-0 text-xs text-muted">
                {formatReminderTime(reminder.remindAt)}
              </span>
              <button
                onClick={() => setSnoozing(snoozing === reminder.id ? null : reminder.id)}
                aria-label="Hatırlatmayı ertele"
                title="Ertele"
                className={snoozing === reminder.id ? quietIconButtonClass : iconButtonClass}
              >
                <Clock className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(reminder.id)}
                aria-label="Hatırlatmayı sil"
                title="Sil"
                className={`${iconButtonClass} hover:text-negative`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {snoozing === reminder.id && (
              <div className="animate-fade mt-2 flex flex-wrap gap-1.5 pl-7">
                {SNOOZE_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    onClick={() => {
                      setSnoozing(null)
                      onSnooze(reminder.id, option.minutes)
                    }}
                    className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ReminderSection
