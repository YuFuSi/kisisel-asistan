import { CheckCircle2 } from 'lucide-react'
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
      tasks: pending.filter((task) => task.dueDate !== null && task.dueDate < today)
    },
    { label: 'Bugün', tasks: pending.filter((task) => task.dueDate === today) },
    {
      label: 'Yaklaşan',
      tasks: pending.filter((task) => task.dueDate !== null && task.dueDate > today)
    },
    { label: 'Tarihsiz', tasks: pending.filter((task) => task.dueDate === null) }
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
          {groups
            .filter((group) => group.tasks.length > 0)
            .map((group) => (
              <section key={group.label} aria-label={group.label} className="space-y-2 pt-3">
                <h2 className="text-sm font-medium text-muted">
                  {group.label} · {group.tasks.length}
                </h2>
                <ul className="space-y-1">{group.tasks.map(taskRow)}</ul>
              </section>
            ))}
          <details className="rounded-control border border-line">
            <summary className="min-h-10 cursor-pointer px-3 py-2 text-sm text-muted">
              Tamamlanan · {done.length}
            </summary>
            {done.length ? (
              <ul className="space-y-1 px-2 pb-2">{done.map(taskRow)}</ul>
            ) : (
              <p className="px-3 pb-3 text-sm text-faint">Henüz tamamlanan görev yok.</p>
            )}
          </details>
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
