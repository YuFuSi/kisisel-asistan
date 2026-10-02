import { AlertTriangle, CalendarClock, CheckCircle2, Inbox, Sun } from 'lucide-react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import IconTile, { type IconTone } from '../components/ui/IconTile'
import type { Automation, Reminder, Task } from '@shared/api'
import NewTaskForm from '../components/tasks/NewTaskForm'
import TaskItem from '../components/tasks/TaskItem'
import ReminderSection from '../components/tasks/ReminderSection'
import EmptyState from '../components/ui/EmptyState'
import InlineError from '../components/ui/InlineError'
import PageLayout from '../components/ui/PageLayout'
import Skeleton from '../components/ui/Skeleton'
import Tabs, { type TabItem } from '../components/ui/Tabs'
import AutomationsPage from './AutomationsPage'
import { celebrate } from '../lib/assistantState'
import { errorMessage } from '../lib/errors'
import { useToast } from '../lib/toast'
import { useLiveData } from '../lib/useLiveData'
import { useClock } from '../lib/deviceStatus'
import { toIsoDate } from '../lib/dates'

// Planlama: "belli bir zamanda olacak şeyler" tek sayfada. Eskiden Görevler (görev + hatırlatma)
// ve Otomasyonlar ayrı sayfalardı; tasarım turunda sekmelere toplandı.

export type PlanningTab = 'tasks' | 'reminders' | 'routines'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()
const loadAutomations = (): Promise<Automation[]> => window.api.automations.list()

interface PlanningPageProps {
  tab: PlanningTab
  onTabChange: (tab: PlanningTab) => void
}

function PlanningPage({ tab, onTabChange }: PlanningPageProps): React.JSX.Element {
  const tasks = useLiveData(loadTasks, 'tasks')
  const reminders = useLiveData(loadReminders, 'reminders')
  const automations = useLiveData(loadAutomations, 'automations')
  const today = toIsoDate(useClock(60_000))
  const toast = useToast()

  // Değişiklikten sonra listeler, ana süreçten gelen "veri değişti" haberiyle kendiliğinden yenilenir
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const all = tasks.data ?? []
  const pending = all.filter((task) => task.doneAt === null)
  const done = all.filter((task) => task.doneAt !== null)
  const groups = [
    {
      label: 'Gecikmiş',
      icon: AlertTriangle,
      tone: 'amber' as IconTone,
      tasks: pending.filter((task) => task.dueDate !== null && task.dueDate < today)
    },
    {
      label: 'Bugün',
      icon: Sun,
      tone: 'lilac' as IconTone,
      tasks: pending.filter((task) => task.dueDate === today)
    },
    {
      label: 'Yaklaşan',
      icon: CalendarClock,
      tone: 'blue' as IconTone,
      tasks: pending.filter((task) => task.dueDate !== null && task.dueDate > today)
    },
    {
      label: 'Tarihsiz',
      icon: Inbox,
      tone: 'teal' as IconTone,
      tasks: pending.filter((task) => task.dueDate === null)
    }
  ]
  function taskRow(task: Task): React.JSX.Element {
    return (
      <TaskItem
        key={task.id}
        task={task}
        onToggle={() => {
          const completing = task.doneAt === null
          void run(() => window.api.tasks.update(task.id, { done: completing })).then((ok) => {
            if (ok && completing) celebrate()
          })
        }}
        onRename={(title) => void run(() => window.api.tasks.update(task.id, { title }))}
        onDelete={() => void run(() => window.api.tasks.remove(task.id))}
      />
    )
  }

  const tabs: TabItem<PlanningTab>[] = [
    { id: 'tasks', label: 'Görevler', count: tasks.data ? pending.length : null },
    { id: 'reminders', label: 'Hatırlatmalar', count: reminders.data?.length ?? null },
    { id: 'routines', label: 'Rutinler', count: automations.data?.length ?? null }
  ]

  return (
    <PageLayout
      title="Planlama"
      description={
        'Görevlerin, hatırlatmaların ve Jarvis\'in kendiliğinden yaptığı rutinler. Sohbette "listeme ekle", "yarın 10\'da hatırlat" veya "her sabah özetle" diyerek de ekleyebilirsin.'
      }
      tabs={<Tabs items={tabs} value={tab} onChange={onTabChange} />}
    >
      {tab === 'tasks' && (
        <section className="space-y-3">
          <NewTaskForm onCreate={(input) => run(() => window.api.tasks.create(input))} />

          {tasks.data && pending.length === 0 && (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Bekleyen görevin yok"
              description="Hızlı ekleme kutusunu kullanabilir veya Jarvis’e söyleyebilirsin."
            />
          )}
          {!tasks.data && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          )}
          {/* Görev bir gruptan ötekine (ör. Tamamlanan'a) akarak geçer */}
          <LayoutGroup>
            {groups
              .filter((group) => group.tasks.length > 0)
              .map((group) => (
                <section key={group.label} aria-label={group.label} className="space-y-2 pt-4">
                  <h2 className="flex items-center gap-2.5 text-sm font-medium text-ink">
                    <IconTile icon={group.icon} tone={group.tone} size={24} />
                    {group.label}
                    <span className="text-muted">{group.tasks.length}</span>
                  </h2>
                  <ul className="space-y-1.5">
                    <AnimatePresence initial={false}>{group.tasks.map(taskRow)}</AnimatePresence>
                  </ul>
                </section>
              ))}
            <details className="glass-soft mt-4 !rounded-[20px]">
              <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-ink">
                <IconTile icon={CheckCircle2} tone="green" size={24} />
                Tamamlanan
                <span>{done.length}</span>
              </summary>
              {done.length ? (
                <ul className="space-y-1.5 px-2 pb-2">
                  <AnimatePresence initial={false}>{done.map(taskRow)}</AnimatePresence>
                </ul>
              ) : (
                <p className="px-3 pb-3 text-sm text-faint">Henüz tamamlanan görev yok.</p>
              )}
            </details>
          </LayoutGroup>
          <InlineError message={tasks.error} />
        </section>
      )}

      {tab === 'reminders' && (
        <ReminderSection
          reminders={reminders.data}
          onCreate={(message, remindAt, repeat) =>
            run(() => window.api.reminders.create(message, remindAt, repeat))
          }
          onDelete={(id) => void run(() => window.api.reminders.remove(id))}
          onSnooze={(id, minutes) => void run(() => window.api.reminders.snooze(id, minutes))}
        />
      )}

      {tab === 'routines' && <AutomationsPage />}
    </PageLayout>
  )
}

export default PlanningPage
