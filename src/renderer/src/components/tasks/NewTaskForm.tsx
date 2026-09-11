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

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!title.trim()) return
    if (await onCreate({ title, dueDate: dueDate || null })) {
      setTitle('')
      setDueDate('')
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
        onChange={(e) => setDueDate(e.target.value)}
        title="Son tarih (isteğe bağlı)"
        aria-label="Son tarih"
        className={`${compactInputClass} w-40`}
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className={`${primaryButtonClass} inline-flex items-center gap-1.5`}
      >
        <Plus className="h-4 w-4" />
        Ekle
      </button>
    </form>
  )
}

export default NewTaskForm
