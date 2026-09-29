import { useState } from 'react'
import { CheckCircle2, ListTodo } from 'lucide-react'
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
import { errorMessage } from '../lib/errors'
import { useToast } from '../lib/toast'
import { useLiveData } from '../lib/useLiveData'

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

type TaskFilter = 'pending' | 'done'

function PlanningPage({ tab, onTabChange }: PlanningPageProps): React.JSX.Element {
  const tasks = useLiveData(loadTasks, 'tasks')
  const reminders = useLiveData(loadReminders, 'reminders')
  const automations = useLiveData(loadAutomations, 'automations')
  const [filter, setFilter] = useState<TaskFilter>('pending')
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
  const visible = filter === 'pending' ? pending : done

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

          <div className="flex gap-4 text-sm">
            {(['pending', 'done'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={filter === id ? 'text-ink' : 'text-faint hover:text-muted'}
              >
                {id === 'pending' ? `Bekleyen (${pending.length})` : `Tamamlanan (${done.length})`}
              </button>
            ))}
          </div>

          {tasks.data && visible.length === 0 && (
            <EmptyState
              compact
              icon={filter === 'pending' ? CheckCircle2 : ListTodo}
              title={filter === 'pending' ? 'Bekleyen görevin yok' : 'Tamamlanan görev yok'}
              description={
                filter === 'pending'
                  ? 'Yukarıdaki kutudan ekleyebilir ya da Jarvis’e "listeme ekle" diyebilirsin.'
                  : 'Bitirdiğin görevler burada birikir.'
              }
            />
          )}
          {!tasks.data && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          )}
          <ul className="space-y-1">
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() =>
                  void run(() => window.api.tasks.update(task.id, { done: task.doneAt === null }))
                }
                onRename={(title) => void run(() => window.api.tasks.update(task.id, { title }))}
                onDelete={() => void run(() => window.api.tasks.remove(task.id))}
              />
            ))}
          </ul>
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
