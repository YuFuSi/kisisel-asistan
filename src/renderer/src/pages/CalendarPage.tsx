import { useEffect, useMemo, useState } from 'react'
import { motion, MotionConfig } from 'motion/react'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  MapPin,
  Plus
} from 'lucide-react'
import type { CalendarItem, Reminder, Task } from '@shared/api'
import {
  buildAgenda,
  gridRange,
  monthGrid,
  WEEKDAY_LABELS,
  type AgendaEntry,
  type AgendaKind
} from '../lib/calendar'
import { useNarrowWindow } from '../lib/useNarrowWindow'
import PageLayout from '../components/ui/PageLayout'
import IconTile from '../components/ui/IconTile'
import { useReducedMotion } from '../lib/useReducedMotion'
import { toIsoDate } from '../lib/dates'
import { useClock } from '../lib/deviceStatus'
import { errorMessage } from '../lib/errors'
import { primaryButtonClass, secondaryButtonClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { useLiveData } from '../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()

const DOT_CLASS: Record<AgendaKind, string> = {
  event: 'bg-accent',
  reminder: 'bg-caution',
  task: 'bg-positive'
}

const KIND_LABELS: Record<AgendaKind, string> = {
  event: 'Etkinlik',
  reminder: 'Hatırlatma',
  task: 'Görev'
}

const navigationClass =
  'glass-soft inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center text-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const taskInputClass =
  'w-full min-w-0 rounded-xl border border-line bg-white/5 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20'

const rowTransition = { type: 'spring', stiffness: 260, damping: 28 } as const

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

function entryTime(entry: AgendaEntry): string {
  if (entry.kind === 'task') return entry.time === null ? 'Görev' : formatTime(entry.time)
  if (entry.time === null) return 'Tüm gün'
  return entry.end ? `${formatTime(entry.time)}–${formatTime(entry.end)}` : formatTime(entry.time)
}

interface GoogleState {
  connected: boolean
  error: string | null
}

interface CalendarPageProps {
  onOpenSettings: () => void
}

// Ay görünümü: Google Takvim etkinlikleri, hatırlatmalar ve son tarihli görevler bir arada
function CalendarPage({ onOpenSettings }: CalendarPageProps): React.JSX.Element {
  const toast = useToast()
  const narrow = useNarrowWindow()
  const reduced = useReducedMotion()
  const now = useClock(60_000)
  const [cursor, setCursor] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })
  const [selected, setSelected] = useState(() => toIsoDate(new Date()))
  const [newTask, setNewTask] = useState('')
  const tasks = useLiveData(loadTasks, 'tasks')
  const reminders = useLiveData(loadReminders, 'reminders')
  const [events, setEvents] = useState<CalendarItem[]>([])
  const [google, setGoogle] = useState<GoogleState | null>(null)

  const todayIso = toIsoDate(now)
  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month, new Date(`${todayIso}T12:00:00`)),
    [cursor, todayIso]
  )

  // Görünen ayın Google Takvim etkinlikleri (hesap bağlıysa)
  useEffect(() => {
    let alive = true
    const { from, to } = gridRange(cells)
    window.api.google
      .status()
      .then(async (status) => {
        if (!status.connected) {
          if (alive) {
            setEvents([])
            setGoogle({ connected: false, error: null })
          }
          return
        }
        const items = await window.api.calendar.events(from.toISOString(), to.toISOString())
        if (alive) {
          setEvents(items)
          setGoogle({ connected: true, error: null })
        }
      })
      .catch((err) => {
        if (alive) setGoogle({ connected: true, error: errorMessage(err) })
      })
    return () => {
      alive = false
    }
  }, [cells])

  const taskList = useMemo(() => tasks.data ?? [], [tasks.data])
  const reminderList = useMemo(() => reminders.data ?? [], [reminders.data])
  const agendaByDay = useMemo(
    () =>
      new Map(
        cells.map((cell) => [cell.iso, buildAgenda(cell.iso, events, reminderList, taskList)])
      ),
    [cells, events, reminderList, taskList]
  )
  const agenda = agendaByDay.get(selected) ?? buildAgenda(selected, events, reminderList, taskList)

  const monthTitle = new Date(cursor.year, cursor.month, 1).toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric'
  })
  const [selectedYear, selectedMonth, selectedDay] = selected.split('-').map(Number)
  const selectedTitle = new Date(selectedYear, selectedMonth - 1, selectedDay).toLocaleDateString(
    'tr-TR',
    { day: 'numeric', month: 'long', weekday: 'long' }
  )

  function shiftDay(delta: number): void {
    const date = new Date(`${selected}T12:00:00`)
    date.setDate(date.getDate() + delta)
    setSelected(toIsoDate(date))
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }
  function shiftMonth(delta: number): void {
    setCursor(({ year, month }) => {
      const date = new Date(year, month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  function goToday(): void {
    const today = new Date()
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
    setSelected(toIsoDate(today))
  }

  async function addTask(): Promise<void> {
    const title = newTask.trim()
    if (!title) return
    try {
      await window.api.tasks.create({ title, dueDate: selected })
      setNewTask('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function toggleTask(entry: AgendaEntry): Promise<void> {
    if (entry.taskId === null) return
    try {
      await window.api.tasks.update(entry.taskId, { done: !entry.done })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <PageLayout
        title="Takvim"
        description="Etkinlikler, hatırlatmalar ve son tarihli görevler bir arada."
        width="wide"
        reduceMotion={reduced}
        actions={
          <>
            <button onClick={goToday} className={secondaryButtonClass}>
              Bugün
            </button>
            <button
              onClick={() => (narrow ? shiftDay(-1) : shiftMonth(-1))}
              aria-label={narrow ? 'Önceki gün' : 'Önceki ay'}
              className={navigationClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 max-w-64 text-center text-sm font-medium text-ink capitalize">
              {narrow ? selectedTitle : monthTitle}
            </span>
            <button
              onClick={() => (narrow ? shiftDay(1) : shiftMonth(1))}
              aria-label={narrow ? 'Sonraki gün' : 'Sonraki ay'}
              className={navigationClass}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        }
      >
        <div className="grid gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-4">
            {google && !google.connected && (
              <p className="glass-soft px-4 py-3 text-xs leading-relaxed text-muted">
                Google hesabı bağlı değil; takvimde görevlerin ve hatırlatmaların görünüyor.{' '}
                <button onClick={onOpenSettings} className="text-accent hover:text-accent-hover">
                  Hesabı bağla
                </button>
              </p>
            )}
            {google?.error && (
              <p className="glass-soft break-words px-4 py-3 text-xs text-negative ring-1 ring-negative/30 select-text [overflow-wrap:anywhere]">
                Takvim etkinlikleri alınamadı: {google.error}
              </p>
            )}

            {!narrow && (
              <div className="glass min-w-0 p-4">
                <h2 className="mb-5 flex items-center gap-3 text-sm font-semibold text-ink capitalize">
                  <IconTile icon={CalendarDays} tone="blue" size={30} />
                  {monthTitle}
                </h2>
                <div className="grid grid-cols-7 gap-1.5 pb-3">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center text-xs text-faint">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((cell) => {
                    const entries = agendaByDay.get(cell.iso) ?? []
                    const kinds = [...new Set(entries.map((entry) => entry.kind))]
                    const isSelected = cell.iso === selected
                    return (
                      <motion.button
                        key={cell.iso}
                        onClick={() => setSelected(cell.iso)}
                        aria-label={`${cell.iso} · ${entries.length} kayıt`}
                        aria-pressed={isSelected}
                        aria-current={cell.today ? 'date' : undefined}
                        whileHover={reduced ? undefined : { y: -1 }}
                        transition={rowTransition}
                        className={`glass-soft flex min-h-24 min-w-0 flex-col gap-1 p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          isSelected ? 'ring-1 ring-accent/60' : 'hover:bg-white/[0.06]'
                        } ${cell.inMonth ? 'text-ink' : 'text-faint'}`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            cell.today ? 'bg-accent font-semibold text-app' : ''
                          }`}
                        >
                          {cell.day}
                        </span>
                        {entries[0] && (
                          <span className="w-full truncate text-[11px] text-muted">
                            {entries[0].title}
                          </span>
                        )}
                        <span className="mt-auto flex gap-1">
                          {kinds.map((kind) => (
                            <span
                              key={kind}
                              className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[kind]}`}
                            />
                          ))}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
            {!narrow && (
              <div className="glass-soft flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-xs text-muted">
                {(Object.keys(KIND_LABELS) as AgendaKind[]).map((kind) => (
                  <span key={kind} className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[kind]}`} />
                    {KIND_LABELS[kind]}
                  </span>
                ))}
              </div>
            )}
          </section>

          <aside className="glass flex min-w-0 flex-col self-start p-5">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-ink capitalize">
              <IconTile icon={Clock} tone="blue" size={30} />
              {selectedTitle}
            </h2>

            {agenda.length === 0 ? (
              <p className="glass-soft mt-4 px-4 py-5 text-center text-sm text-faint">
                Bu gün için bir şey yok.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {agenda.map((entry) => (
                  <motion.li
                    key={entry.key}
                    layout={!reduced}
                    initial={false}
                    transition={rowTransition}
                    className="glass-soft flex items-start gap-3 p-3"
                  >
                    {entry.kind === 'task' ? (
                      <button
                        onClick={() => void toggleTask(entry)}
                        aria-label={entry.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamla'}
                        aria-pressed={entry.done}
                        className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-control text-positive transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive"
                      >
                        {entry.done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                    ) : entry.kind === 'reminder' ? (
                      <span className="shrink-0">
                        <IconTile icon={Bell} tone="amber" size={28} />
                      </span>
                    ) : (
                      <span className="shrink-0">
                        <IconTile icon={CalendarDays} tone="blue" size={28} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm break-words [overflow-wrap:anywhere] ${entry.done ? 'text-faint line-through' : 'text-ink'}`}
                      >
                        {entry.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                        <span>{entryTime(entry)}</span>
                        {entry.detail && (
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            {entry.kind === 'event' && <MapPin className="h-3 w-3 shrink-0" />}
                            {entry.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <div className="min-w-0 flex-1 basis-40">
                <input
                  aria-label="Bu güne görev ekle"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) void addTask()
                  }}
                  placeholder="Bu güne görev ekle"
                  className={taskInputClass}
                />
              </div>
              <button
                onClick={() => void addTask()}
                disabled={!newTask.trim()}
                aria-label="Görev ekle"
                className={primaryButtonClass}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      </PageLayout>
    </MotionConfig>
  )
}

export default CalendarPage
