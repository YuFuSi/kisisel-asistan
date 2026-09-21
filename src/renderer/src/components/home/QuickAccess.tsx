import {
  Brain,
  CalendarDays,
  ChevronRight,
  ListTodo,
  MessageSquare,
  Sun,
  type LucideIcon
} from 'lucide-react'
import type { Conversation, Memory, Note, Reminder, Task } from '@shared/api'
import { toIsoDate } from '../../lib/dates'
import type { PageId } from '../../lib/pages'
import { useLiveData } from '../../lib/useLiveData'
import HomeCard from './HomeCard'

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
      title: 'Görevler',
      detail: tasks
        ? `${pending.length} bekleyen${dueToday > 0 ? ` · ${dueToday} bugün` : ''}`
        : null
    },
    {
      page: 'calendar',
      icon: CalendarDays,
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
      title: 'Hafıza Merkezi',
      detail: memories && notes ? `${memories.length} bilgi · ${notes.length} not` : null
    },
    {
      page: 'chat',
      icon: MessageSquare,
      title: 'Asistan',
      detail: conversations ? `${conversations.length} sohbet` : null
    }
  ]

  return (
    <HomeCard title="Bugün" icon={Sun}>
      <ul className="-mx-2 space-y-0.5">
        {shortcuts.map(({ page, icon: Icon, title, detail }) => (
          <li key={page}>
            <button
              onClick={() => onNavigate(page)}
              className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-elevated"
            >
              <Icon className="h-4 w-4 shrink-0 text-faint group-hover:text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{title}</span>
                <span className="block truncate text-xs text-muted">{detail ?? '...'}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </HomeCard>
  )
}

export default QuickAccess
