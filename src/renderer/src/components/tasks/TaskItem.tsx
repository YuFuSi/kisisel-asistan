import { useRef, useState } from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import type { Task } from '@shared/api'
import { describeDueDate } from '../../lib/dates'
import { iconButtonClass, inputClass } from '../../lib/styles'

interface TaskItemProps {
  task: Task
  onToggle: () => void
  onRename: (title: string) => void
  onDelete: () => void
}

function TaskItem({ task, onToggle, onRename, onDelete }: TaskItemProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  // Escape ile çıkıldığında değişiklik kaydedilmesin
  const cancelled = useRef(false)

  const done = task.doneAt !== null
  const due = task.dueDate ? describeDueDate(task.dueDate) : null

  function startEditing(): void {
    setDraft(task.title)
    setEditing(true)
  }

  function finishEditing(): void {
    setEditing(false)
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const value = draft.trim()
    if (value && value !== task.title) onRename(value)
  }

  let dueClass = 'bg-elevated text-muted'
  if (due && !done && due.overdue) dueClass = 'bg-negative/10 text-negative'
  else if (due && !done && due.today) dueClass = 'bg-caution/10 text-caution'

  return (
    <li className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface">
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? 'border-positive bg-positive text-app'
            : 'border-line-strong hover:border-line-strong'
        }`}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              cancelled.current = true
              e.currentTarget.blur()
            }
          }}
          className={inputClass}
        />
      ) : (
        <span
          onDoubleClick={startEditing}
          title="Düzenlemek için çift tıkla"
          className={`min-w-0 flex-1 truncate py-1 text-sm ${
            done ? 'text-faint line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </span>
      )}

      {due && !editing && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${dueClass}`}>{due.text}</span>
      )}
      {!editing && (
        <button
          onClick={startEditing}
          aria-label="Görevi düzenle"
          title="Düzenle"
          className={`${iconButtonClass} hover:text-ink`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onDelete}
        aria-label="Görevi sil"
        title="Sil"
        className={`${iconButtonClass} hover:text-negative`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}

export default TaskItem
