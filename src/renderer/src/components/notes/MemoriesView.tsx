import { useState } from 'react'
import { Brain, Plus, Trash2 } from 'lucide-react'
import type { Memory } from '@shared/api'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import { iconButtonClass, inputClass, primaryButtonClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadMemories = (): Promise<Memory[]> => window.api.memories.list()

function MemoriesView(): React.JSX.Element {
  const memories = useLiveData(loadMemories, 'memories')
  const [draft, setDraft] = useState('')
  const toast = useToast()
  const error = memories.error

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.trim()) return
    try {
      await window.api.memories.create(draft)
      setDraft('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function remove(id: number): Promise<void> {
    try {
      await window.api.memories.remove(id)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <p className="text-sm text-muted">
          Asistan buradaki bilgileri her sohbette hatırlar. Sohbette &quot;bunu hatırla&quot;
          dediğinde buraya eklenir. İstemediğin bilgiyi silebilirsin.
        </p>

        <form onSubmit={(e) => void add(e)} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ör. Kahvemi şekersiz içerim"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className={`${primaryButtonClass} inline-flex items-center gap-1.5`}
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </form>

        {memories.data && memories.data.length === 0 && (
          <p className="px-1 py-2 text-sm text-faint">Henüz kayıtlı bilgi yok.</p>
        )}
        <ul className="space-y-1">
          {memories.data?.map((memory) => (
            <li
              key={memory.id}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface"
            >
              <Brain className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 text-sm text-ink select-text">{memory.content}</span>
              <button
                onClick={() => void remove(memory.id)}
                aria-label="Bilgiyi sil"
                title="Sil"
                className={`${iconButtonClass} hover:text-negative`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-negative select-text">{error}</p>}
      </div>
    </div>
  )
}

export default MemoriesView
