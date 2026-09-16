import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { Note, SettingsView } from '@shared/api'
import NoteEditor from './NoteEditor'
import Skeleton from '../ui/Skeleton'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import { inputClass, secondaryButtonClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadNotes = (): Promise<Note[]> => window.api.notes.list()
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()

const firstLine = (text: string): string => text.split('\n').find((line) => line.trim()) ?? ''

function NotesView(): React.JSX.Element {
  const notes = useLiveData(loadNotes, 'notes')
  const settings = useLiveData(loadSettings, 'settings')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [indexing, setIndexing] = useState(false)
  const toast = useToast()

  async function backfillEmbeddings(): Promise<void> {
    setIndexing(true)
    try {
      const count = await window.api.notes.backfillEmbeddings()
      toast.success(
        count === 0 ? 'Zaten güncel, indekslenecek not yok.' : `${count} not indekslendi.`
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setIndexing(false)
    }
  }

  const all = notes.data ?? []
  const q = query.trim().toLocaleLowerCase('tr-TR')
  const filtered = q
    ? all.filter((n) => `${n.title}\n${n.content}`.toLocaleLowerCase('tr-TR').includes(q))
    : all
  const selected = all.find((n) => n.id === selectedId) ?? null
  const error = notes.error

  async function createNote(): Promise<void> {
    try {
      const note = await window.api.notes.create({})
      setQuery('')
      setSelectedId(note.id)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function deleteNote(id: number): Promise<void> {
    if (!window.confirm('Bu not silinsin mi?')) return
    try {
      await window.api.notes.remove(id)
      setSelectedId(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex w-72 shrink-0 flex-col border-r border-line">
        <div className="space-y-2 p-3">
          <button
            onClick={() => void createNote()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated"
          >
            <Plus className="h-4 w-4" />
            Yeni not
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Notlarda ara..."
              style={{ paddingLeft: '2.25rem' }}
              className={inputClass}
            />
          </div>
          {settings.data?.semanticSearchEnabled && (
            <div className="space-y-1.5 rounded-lg border border-line bg-surface px-2.5 py-2">
              <p className="text-xs text-muted">
                Anlamsal arama açık, notlar indekslenmemiş olabilir.
              </p>
              <button
                onClick={() => void backfillEmbeddings()}
                disabled={indexing}
                className={`${secondaryButtonClass} w-full text-xs`}
              >
                {indexing ? 'İndeksleniyor...' : 'İndeksle'}
              </button>
            </div>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {notes.data && filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-faint">
              {q ? 'Eşleşen not yok.' : 'Henüz not yok.'}
            </li>
          )}
          {!notes.data &&
            [0, 1, 2].map((row) => (
              <li key={row} className="px-1 py-1">
                <Skeleton className="h-11 w-full" />
              </li>
            ))}
          {filtered.map((note) => {
            const isSelected = note.id === selectedId
            return (
              <li key={note.id}>
                <button
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-elevated' : 'hover:bg-elevated/60'
                  }`}
                >
                  <div className={`truncate text-sm ${isSelected ? 'text-white' : 'text-ink'}`}>
                    {note.title || 'Başlıksız not'}
                  </div>
                  <div className="truncate text-xs text-faint">
                    {firstLine(note.content) || 'Boş not'}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {error && <p className="border-t border-line p-3 text-xs text-negative">{error}</p>}
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onDelete={() => void deleteNote(selected.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-faint">
            {all.length > 0
              ? 'Soldan bir not seç.'
              : 'İlk notunu oluşturmak için "Yeni not" butonuna tıkla.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesView
