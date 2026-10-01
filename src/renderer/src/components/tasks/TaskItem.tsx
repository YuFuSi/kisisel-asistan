import { useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
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
  const due = task.dueDate ? describeDueDate(task.dueDate, task.dueTime) : null

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
    <motion.li
      layout
      layoutId={`task-${task.id}`}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="glass-soft group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.06]"
    >
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control"
      >
        <motion.span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
          animate={{
            backgroundColor: done ? 'rgb(95 201 160 / 1)' : 'rgb(255 255 255 / 0)',
            boxShadow: done
              ? 'inset 0 0 0 1.5px rgb(95 201 160 / 1), 0 0 14px rgb(95 201 160 / 0.45)'
              : 'inset 0 0 0 1.5px rgb(255 255 255 / 0.28), 0 0 0px rgb(95 201 160 / 0)'
          }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#0b0c0f"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
        </motion.span>
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
              e.stopPropagation()
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
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${dueClass}`}>
          {due.text}
        </span>
      )}
      {!editing && (
        <button
          onClick={startEditing}
          aria-label="Görevi düzenle"
          title="Düzenle"
          className={`${iconButtonClass} opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onDelete}
        aria-label="Görevi sil"
        title="Sil"
        className={`${iconButtonClass} opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-negative`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.li>
  )
}

export default TaskItem
