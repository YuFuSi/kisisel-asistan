import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { TaskInput } from '@shared/api'
import { compactInputClass, primaryButtonClass } from '../../lib/styles'

interface NewTaskFormProps {
  /** Başarılı olursa true döner; o zaman form temizlenir */
  onCreate: (input: TaskInput) => Promise<boolean>
}

function NewTaskForm({ onCreate }: NewTaskFormProps): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  // Kayıt sürerken ikinci Enter/tıklama aynı görevi tekrar oluşturmasın
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="glass flex flex-wrap items-center gap-2 !rounded-[22px] p-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Yeni görev"
        placeholder="Yeni görev ekle..."
        className="min-h-10 min-w-40 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-faint"
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
      <button type="submit" disabled={!title.trim() || saving} className={primaryButtonClass}>
        <Plus className="h-4 w-4" />
        Ekle
      </button>
    </form>
  )
}

export default NewTaskForm
