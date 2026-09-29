import { useEffect, useState } from 'react'
import {
  BarChart3,
  Brain,
  CalendarDays,
  Clock,
  House,
  ListTodo,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import type { Automation, AutomationRun, CalendarItem, Reminder, Task } from '@shared/api'
import { requestNewChat } from '../lib/chatRequests'
import { PAGE_LABELS, type PageId } from '../lib/pages'
import { buildSuggestions, type Suggestion } from '../lib/sidebarSuggestions'
import { buildTimeline, nowIndex, type TimelineItem } from '../lib/sidebarTimeline'
import { buildWorkers, type Worker } from '../lib/sidebarWorkers'
import { useClock } from '../lib/deviceStatus'
import { toIsoDate } from '../lib/dates'

// Tasarım turu: 9 sayfa 6'ya indi (Otomasyonlar → Planlama > Rutinler, Başarımlar → Analizler).
// Ayarlar ana listede değil, menünün en altında.
const ITEMS: { id: PageId; icon: LucideIcon }[] = [
  { id: 'home', icon: House },
  { id: 'chat', icon: MessageSquare },
  { id: 'tasks', icon: ListTodo },
  { id: 'calendar', icon: CalendarDays },
  { id: 'notes', icon: Brain },
  { id: 'analytics', icon: BarChart3 }
]

const STORAGE_KEY = 'sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// package.json'daki sürüm; menünün altında gösterilir
function useAppVersion(): string {
  const [version, setVersion] = useState('')
  useEffect(() => {
    window.api.app.version().then(setVersion, () => setVersion(''))
  }, [])
  return version
}

// Bugünün Google Takvim etkinlikleri; hesap bağlı değilse sessizce boş kalır. CalendarPage'deki
// gibi sadece mount'ta çekilir, otomatik yenileme yok (etkinlikler oturum içinde nadiren değişir).
function useTodayEvents(now: Date): CalendarItem[] {
  const [events, setEvents] = useState<CalendarItem[]>([])
  const dayStart = toIsoDate(now)

  useEffect(() => {
    let active = true
    const from = new Date(`${dayStart}T00:00:00`)
    const to = new Date(from.getTime() + 26 * 60 * 60 * 1000)
    window.api.google.status().then((status) => {
      if (!active || !status.connected) return
      window.api.calendar.events(from.toISOString(), to.toISOString()).then((items) => {
        if (active) setEvents(items)
      }, noop)
    }, noop)
    return () => {
      active = false
    }
  }, [dayStart])

  return events
}

// Bugünün saatli görev, hatırlatma ve takvim etkinlikleri; veri değişince (asistan eklese bile) kendiliğinden yenilenir
function useTimeline(now: Date): TimelineItem[] {
  const [tasks, setTasks] = useState<Task[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const events = useTodayEvents(now)

  useEffect(() => {
    let active = true
    const load = (): void => {
      Promise.all([window.api.tasks.list(), window.api.reminders.list()]).then(([t, r]) => {
        if (active) {
          setTasks(t)
          setReminders(r)
        }
      }, noop)
    }
    load()
    const unsubscribe = window.api.events.onDataChanged((scope) => {
      if (scope === 'tasks' || scope === 'reminders') load()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return buildTimeline({ tasks, reminders, events, now })
}

function useSuggestions(now: Date): Suggestion[] {
  const [tasks, setTasks] = useState<Task[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])

  useEffect(() => {
    let active = true
    const load = (): void => {
      Promise.all([window.api.tasks.list(), window.api.reminders.list()]).then(([t, r]) => {
        if (active) {
          setTasks(t)
          setReminders(r)
        }
      }, noop)
    }
    load()
    const unsubscribe = window.api.events.onDataChanged((scope) => {
      if (scope === 'tasks' || scope === 'reminders') load()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return buildSuggestions({ tasks, reminders, now })
}

// Açık rutinlerden şu an çalışanlar ve yakında çalışacaklar; her rutinin son çalıştırması ayrıca sorulur
function useWorkers(now: number): Worker[] {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [lastRuns, setLastRuns] = useState<Map<number, AutomationRun | undefined>>(new Map())

  useEffect(() => {
    let active = true
    const load = (): void => {
      window.api.automations.list().then((list) => {
        if (!active) return
        setAutomations(list)
        const enabled = list.filter((a) => a.enabled)
        Promise.all(enabled.map((a) => window.api.automations.listRuns(a.id))).then((runsList) => {
          if (!active) return
          const map = new Map<number, AutomationRun | undefined>()
          enabled.forEach((a, i) => map.set(a.id, runsList[i][0]))
          setLastRuns(map)
        }, noop)
      }, noop)
    }
    load()
    const unsubscribe = window.api.events.onDataChanged((scope) => {
      if (scope === 'automations' || scope === 'activity') load()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return buildWorkers(automations, lastRuns, now)
}

function noop(): void {
  // Sidebar sessizce eski veriyle kalır; hata kutusu göstermeye değmez
}

interface SidebarProps {
  active: PageId
  onSelect: (page: PageId) => void
}

function Sidebar({ active, onSelect }: SidebarProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const version = useAppVersion()
  const now = useClock(30_000)
  const timeline = useTimeline(now)
  const suggestions = useSuggestions(now)
  const workers = useWorkers(now.getTime())
  const upcomingIndex = nowIndex(timeline, now)

  function toggle(): void {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Depolama kapalıysa ayar sadece bu oturum için geçerli olur
    }
  }

  function runSuggestion(suggestion: Suggestion): void {
    if (suggestion.action.kind === 'open-tasks') {
      onSelect('tasks')
    } else {
      onSelect('chat')
      requestNewChat(suggestion.action.prompt)
    }
  }

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-y-auto border-r border-line bg-app py-4 transition-[width] duration-200 ${
        collapsed ? 'w-[64px] px-2' : 'w-[264px] px-3'
      }`}
    >
      <nav className="flex flex-col gap-1">
        {ITEMS.map(({ id, icon: Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              title={collapsed ? PAGE_LABELS[id] : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-[10px] text-sm transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive
                  ? 'bg-elevated font-medium text-ink'
                  : 'text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {isActive && (
                <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-accent" />
              )}
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-accent' : ''}`} />
              {!collapsed && <span className="truncate">{PAGE_LABELS[id]}</span>}
            </button>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {/* Bugün: saatli görev ve hatırlatmalar, "şimdi" çizgisiyle */}
          {timeline.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
                <Clock className="h-3 w-3" />
                Bugün
              </div>
              <ol className="space-y-0.5">
                {timeline.map((item, i) => (
                  <li key={item.id}>
                    {i === upcomingIndex && i > 0 && (
                      <div className="my-1 flex items-center gap-2 px-2">
                        <span className="h-px flex-1 bg-accent/40" />
                        <span className="text-[10px] text-accent/70">şimdi</span>
                        <span className="h-px flex-1 bg-accent/40" />
                      </div>
                    )}
                    <button
                      onClick={() => onSelect(item.kind === 'event' ? 'calendar' : 'tasks')}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-surface ${
                        item.done
                          ? 'text-faint line-through'
                          : item.overdue
                            ? 'text-negative'
                            : 'text-muted'
                      }`}
                    >
                      <span className="w-9 shrink-0 tabular-nums">{item.time}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Arka plan işçileri: çalışan ve yakında çalışacak rutinler */}
          {workers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase">
                <Workflow className="h-3 w-3" />
                Çalışıyor
              </div>
              <ul className="space-y-1">
                {workers.map((worker) => (
                  <li key={worker.id}>
                    <button
                      onClick={() => onSelect('automations')}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-muted transition-colors hover:bg-surface"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          worker.status === 'running' ? 'animate-pulse bg-accent' : 'bg-faint'
                        }`}
                      />
                      <span className="truncate">{worker.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-faint">
                        {worker.status === 'running' ? 'çalışıyor' : `${worker.minutesUntil} dk`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Jarvis'in önerileri: geciken görevler ve yaklaşan hatırlatmalar için tek tıkla harekete geç */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => runSuggestion(suggestion)}
                  className="flex w-full items-start gap-2 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-left text-xs text-muted transition-colors hover:border-accent/40 hover:text-ink"
                >
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  <span>{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <button
          onClick={() => onSelect('settings')}
          title={collapsed ? PAGE_LABELS.settings : undefined}
          aria-current={active === 'settings' ? 'page' : undefined}
          className={`flex h-9 w-full items-center gap-3 rounded-[10px] text-sm transition-colors ${
            collapsed ? 'justify-center px-0' : 'px-3'
          } ${
            active === 'settings'
              ? 'bg-elevated font-medium text-ink'
              : 'text-muted hover:bg-surface hover:text-ink'
          }`}
        >
          <Settings
            className={`h-[18px] w-[18px] shrink-0 ${active === 'settings' ? 'text-accent' : ''}`}
          />
          {!collapsed && <span>{PAGE_LABELS.settings}</span>}
        </button>

        <div className="flex items-center justify-between gap-2">
          {!collapsed && version && <span className="px-2 text-xs text-faint">v{version}</span>}
          <button
            onClick={toggle}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
