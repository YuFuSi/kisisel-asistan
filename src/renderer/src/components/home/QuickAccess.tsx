import {
  Brain,
  CalendarDays,
  ChevronRight,
  ListTodo,
  MessageSquare,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { Conversation, Memory, Note, Reminder, Task } from '@shared/api'
import { toIsoDate } from '../../lib/dates'
import type { PageId } from '../../lib/pages'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()
const loadMemories = (): Promise<Memory[]> => window.api.memories.list()
const loadNotes = (): Promise<Note[]> => window.api.notes.list()
const loadConversations = (): Promise<Conversation[]> => window.api.conversations.list()

interface QuickAccessProps {
  onNavigate: (page: PageId) => void
}

interface Shortcut {
  page: PageId
  icon: LucideIcon
  color: string
  title: string
  detail: string | null
}

// Ana Sayfa'daki sayfa kısayolları; her kart o sayfanın kısa özetini gösterir
function QuickAccess({ onNavigate }: QuickAccessProps): React.JSX.Element {
  const tasks = useLiveData(loadTasks, 'tasks').data
  const reminders = useLiveData(loadReminders, 'reminders').data
  const memories = useLiveData(loadMemories, 'memories').data
  const notes = useLiveData(loadNotes, 'notes').data
  const conversations = useLiveData(loadConversations, 'conversations').data

  const today = toIsoDate(new Date())
  const pending = tasks?.filter((task) => task.doneAt === null) ?? []
  const dueToday = pending.filter((task) => task.dueDate !== null && task.dueDate <= today).length
  const remindersToday =
    reminders?.filter((reminder) => toIsoDate(new Date(reminder.remindAt)) === today).length ?? 0

  const shortcuts: Shortcut[] = [
    {
      page: 'tasks',
      icon: ListTodo,
      color: 'text-positive',
      title: 'Görevler',
      detail: tasks
        ? `${pending.length} bekleyen${dueToday > 0 ? ` · ${dueToday} bugün` : ''}`
        : null
    },
    {
      page: 'calendar',
      icon: CalendarDays,
      color: 'text-accent',
      title: 'Takvim',
      detail: reminders
        ? remindersToday > 0
          ? `Bugün ${remindersToday} hatırlatma`
          : 'Bugün hatırlatma yok'
        : null
    },
    {
      page: 'notes',
      icon: Brain,
      color: 'text-glow',
      title: 'Hafıza Merkezi',
      detail: memories && notes ? `${memories.length} bilgi · ${notes.length} not` : null
    },
    {
      page: 'chat',
      icon: MessageSquare,
      color: 'text-caution',
      title: 'Asistan',
      detail: conversations ? `${conversations.length} sohbet` : null
    }
  ]

  return (
    <section className="w-full">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
        <Zap className="h-4 w-4 text-glow" />
        Hızlı erişim
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {shortcuts.map(({ page, icon: Icon, color, title, detail }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="glass-card group flex flex-col items-start gap-4 p-4 text-left transition-colors transition-transform duration-150 hover:border-accent/50 active:scale-[0.98]"
          >
            <Icon className={`h-6 w-6 ${color}`} />
            <div className="flex w-full items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{title}</div>
                <div className="truncate text-xs text-muted">{detail ?? '...'}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default QuickAccess
