import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { TaskInput } from '@shared/api'
import { compactInputClass, inputClass, primaryButtonClass } from '../../lib/styles'

interface NewTaskFormProps {
  /** Başarılı olursa true döner; o zaman form temizlenir */
  onCreate: (input: TaskInput) => Promise<boolean>
}

function NewTaskForm({ onCreate }: NewTaskFormProps): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!title.trim()) return
    if (
      await onCreate({
        title,
        dueDate: dueDate || null,
        dueTime: dueDate && dueTime ? dueTime : null
      })
    ) {
      setTitle('')
      setDueDate('')
      setDueTime('')
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Yeni görev ekle..."
        className={inputClass}
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => {
          setDueDate(e.target.value)
          if (!e.target.value) setDueTime('')
        }}
        title="Son tarih (isteğe bağlı)"
        aria-label="Son tarih"
        className={`${compactInputClass} w-40`}
      />
      {dueDate && (
        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          title="Saat (isteğe bağlı)"
          aria-label="Saat"
          className={`${compactInputClass} w-28`}
        />
      )}
      <button type="submit" disabled={!title.trim()} className={primaryButtonClass}>
        <Plus className="h-4 w-4" />
        Ekle
      </button>
    </form>
  )
}

export default NewTaskForm
