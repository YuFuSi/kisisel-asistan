import { useState } from 'react'
import type { Reminder, Task } from '@shared/api'
import NewTaskForm from '../components/tasks/NewTaskForm'
import TaskItem from '../components/tasks/TaskItem'
import ReminderSection from '../components/tasks/ReminderSection'
import Skeleton from '../components/ui/Skeleton'
import { errorMessage } from '../lib/errors'
import { useToast } from '../lib/toast'
import { tabClass } from '../lib/styles'
import { useLiveData } from '../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()

type Filter = 'pending' | 'done'

function TasksPage(): React.JSX.Element {
  const tasks = useLiveData(loadTasks, 'tasks')
  const reminders = useLiveData(loadReminders, 'reminders')
  const [filter, setFilter] = useState<Filter>('pending')
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
  const error = tasks.error ?? reminders.error

  const tabs: { id: Filter; label: string }[] = [
    { id: 'pending', label: `Bekleyen (${pending.length})` },
    { id: 'done', label: `Tamamlanan (${done.length})` }
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Görevler</h1>
        <p className="mt-1 text-sm text-muted">
          Yapılacaklar ve hatırlatmalar. Sohbette &quot;listeme ekle&quot; veya &quot;yarın
          10&apos;da hatırlat&quot; diyerek de ekleyebilirsin.
        </p>
      </div>

      <section className="space-y-3">
        <NewTaskForm onCreate={(input) => run(() => window.api.tasks.create(input))} />

        <div className="flex gap-1 border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={tabClass(filter === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tasks.data && visible.length === 0 && (
          <p className="px-1 py-4 text-sm text-faint">
            {filter === 'pending' ? 'Bekleyen görev yok.' : 'Henüz tamamlanan görev yok.'}
          </p>
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
      </section>

      <ReminderSection
        reminders={reminders.data}
        onCreate={(message, remindAt) => run(() => window.api.reminders.create(message, remindAt))}
        onDelete={(id) => void run(() => window.api.reminders.remove(id))}
      />

      {error && <p className="text-sm text-negative select-text">{error}</p>}
    </div>
  )
}

export default TasksPage
