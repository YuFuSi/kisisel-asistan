import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { Note } from '@shared/api'
import NoteEditor from './NoteEditor'
import { errorMessage } from '../../lib/errors'
import { inputClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadNotes = (): Promise<Note[]> => window.api.notes.list()

const firstLine = (text: string): string => text.split('\n').find((line) => line.trim()) ?? ''

function NotesView(): React.JSX.Element {
  const notes = useLiveData(loadNotes, 'notes')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const all = notes.data ?? []
  const q = query.trim().toLocaleLowerCase('tr-TR')
  const filtered = q
    ? all.filter((n) => `${n.title}\n${n.content}`.toLocaleLowerCase('tr-TR').includes(q))
    : all
  const selected = all.find((n) => n.id === selectedId) ?? null
  const error = actionError ?? notes.error

  async function createNote(): Promise<void> {
    try {
      const note = await window.api.notes.create({})
      setQuery('')
      setSelectedId(note.id)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function deleteNote(id: number): Promise<void> {
    if (!window.confirm('Bu not silinsin mi?')) return
    try {
      await window.api.notes.remove(id)
      setSelectedId(null)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800">
        <div className="space-y-2 p-3">
          <button
            onClick={() => void createNote()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Yeni not
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Notlarda ara..."
              style={{ paddingLeft: '2.25rem' }}
              className={inputClass}
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {notes.data && filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-600">
              {q ? 'Eşleşen not yok.' : 'Henüz not yok.'}
            </li>
          )}
          {filtered.map((note) => {
            const isSelected = note.id === selectedId
            return (
              <li key={note.id}>
                <button
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                  }`}
                >
                  <div
                    className={`truncate text-sm ${isSelected ? 'text-white' : 'text-zinc-300'}`}
                  >
                    {note.title || 'Başlıksız not'}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {firstLine(note.content) || 'Boş not'}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {error && <p className="border-t border-zinc-800 p-3 text-xs text-red-400">{error}</p>}
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onDelete={() => void deleteNote(selected.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
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
