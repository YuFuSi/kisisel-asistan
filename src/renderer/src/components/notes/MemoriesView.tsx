import { useState } from 'react'
import { Brain, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Memory, SettingsView } from '@shared/api'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import {
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass
} from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadMemories = (): Promise<Memory[]> => window.api.memories.list()
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()

function MemoriesView(): React.JSX.Element {
  const memories = useLiveData(loadMemories, 'memories')
  const settings = useLiveData(loadSettings, 'settings')
  const [draft, setDraft] = useState('')
  // Düzenlenen kayıt ve yeni metni
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const [indexing, setIndexing] = useState(false)
  const toast = useToast()
  const error = memories.error

  async function backfillEmbeddings(): Promise<void> {
    setIndexing(true)
    try {
      const count = await window.api.memories.backfillEmbeddings()
      toast.success(
        count === 0 ? 'Zaten güncel, indekslenecek kayıt yok.' : `${count} kayıt indekslendi.`
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setIndexing(false)
    }
  }

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.trim()) return
    if (await run(() => window.api.memories.create(draft))) setDraft('')
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return
    const current = memories.data?.find((m) => m.id === editing.id)
    const text = editing.text.trim()
    setEditing(null)
    if (!text || text === current?.content) return
    await run(() => window.api.memories.update(editing.id, text))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <p className="text-sm text-muted">
          Asistan buradaki bilgileri her sohbette hatırlar. Sohbette &quot;bunu hatırla&quot;
          dediğinde buraya eklenir; çok benzer bir bilgi zaten varsa yenisiyle güncellenir. Bir
          bilgiye tıklayarak düzeltebilir veya silebilirsin.
        </p>

        {settings.data?.semanticSearchEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
            <p className="text-sm text-muted">
              Anlamsal arama açık. Mevcut kayıtların hâlâ indekslenmemiş olabilir.
            </p>
            <button
              onClick={() => void backfillEmbeddings()}
              disabled={indexing}
              className={secondaryButtonClass}
            >
              {indexing ? 'İndeksleniyor...' : 'İndeksle'}
            </button>
          </div>
        )}

        <form onSubmit={(e) => void add(e)} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ör. Kahvemi şekersiz içerim"
            maxLength={300}
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
          {memories.data?.map((memory) =>
            editing?.id === memory.id ? (
              <li key={memory.id} className="px-1 py-1">
                <input
                  autoFocus
                  value={editing.text}
                  maxLength={300}
                  onChange={(e) => setEditing({ id: memory.id, text: e.target.value })}
                  onBlur={() => void saveEdit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  aria-label="Hafıza kaydını düzenle"
                  className={inputClass}
                />
              </li>
            ) : (
              <li
                key={memory.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface"
              >
                <Brain className="h-4 w-4 shrink-0 text-accent" />
                <button
                  onClick={() => setEditing({ id: memory.id, text: memory.content })}
                  title="Düzenlemek için tıkla"
                  className="min-w-0 flex-1 text-left text-sm text-ink"
                >
                  {memory.content}
                </button>
                <button
                  onClick={() => setEditing({ id: memory.id, text: memory.content })}
                  aria-label="Bilgiyi düzenle"
                  title="Düzenle"
                  className={iconButtonClass}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void run(() => window.api.memories.remove(memory.id))}
                  aria-label="Bilgiyi sil"
                  title="Sil"
                  className={`${iconButtonClass} hover:text-negative`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          )}
        </ul>

        {error && <p className="text-sm text-negative select-text">{error}</p>}
      </div>
    </div>
  )
}

export default MemoriesView
