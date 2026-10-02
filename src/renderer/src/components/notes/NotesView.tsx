import { useEffect, useState } from 'react'
import { FileText, Plus, Search } from 'lucide-react'
import { motion } from 'motion/react'
import type { Note, SettingsView } from '@shared/api'
import NoteEditor from './NoteEditor'
import Skeleton from '../ui/Skeleton'
import ConfirmDialog from '../ui/ConfirmDialog'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import { useLiveData } from '../../lib/useLiveData'
import { useReducedMotion } from '../../lib/useReducedMotion'
import IconTile from '../ui/IconTile'
import { inputClass, rowTransition } from './styles'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadNotes = (): Promise<Note[]> => window.api.notes.list()
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()

// Yazmayı bıraktıktan bu kadar süre sonra anlamsal arama gönderilir (NoteEditor'daki otomatik
// kayıt gecikmesiyle aynı fikir: her tuş vuruşunda değil, durulunca istek at)
const SEARCH_DELAY_MS = 400

const firstLine = (text: string): string => text.split('\n').find((line) => line.trim()) ?? ''

function NotesView(): React.JSX.Element {
  const reduced = useReducedMotion()
  const notes = useLiveData(loadNotes, 'notes')
  const settings = useLiveData(loadSettings, 'settings')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [semanticResults, setSemanticResults] = useState<Note[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const toast = useToast()
  // İndeksleme arka planda kendiliğinden yapılır (scheduler/proactive.ts), burada uyarı gösterilmez
  const semanticSearchEnabled = settings.data?.semanticSearchEnabled ?? false

  // Anlamsal arama açıksa, yazmayı bırakınca sorguyu backend'e gönderip anlam benzerliğine göre
  // sıralanmış sonuçları göster; kapalıysa mevcut anahtar-kelime filtresi (aşağıda) devrede kalır.
  useEffect(() => {
    if (!semanticSearchEnabled || !query.trim()) return
    let active = true
    const timer = setTimeout(() => {
      setSearching(true)
      window.api.notes
        .search(query.trim())
        .then(
          (results) => {
            if (active) setSemanticResults(results)
          },
          (err: unknown) => {
            if (active) {
              toast.error(errorMessage(err))
              setSemanticResults(null)
            }
          }
        )
        .finally(() => {
          if (active) setSearching(false)
        })
    }, SEARCH_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, semanticSearchEnabled, toast])

  const all = notes.data ?? []
  const q = query.trim().toLocaleLowerCase('tr-TR')
  const filtered =
    semanticSearchEnabled && q && semanticResults !== null
      ? semanticResults
      : q
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
    try {
      await window.api.notes.remove(id)
      setSelectedId(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl gap-4 px-8 py-6">
      <div className="glass flex min-h-0 w-56 shrink-0 flex-col lg:w-64 xl:w-72">
        <div className="space-y-3 p-4">
          <h2 className="flex items-center gap-3 text-sm font-semibold text-ink">
            <IconTile icon={FileText} tone="pink" size={28} />
            Notlarım
          </h2>
          <button
            onClick={() => void createNote()}
            className="glass-soft flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-4 w-4" />
            Yeni not
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              aria-label="Notlarda ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={semanticSearchEnabled ? 'Anlamıyla ara...' : 'Notlarda ara...'}
              style={{ paddingLeft: '2.25rem' }}
              className={inputClass}
            />
          </div>
          {searching && <p className="px-1 text-xs text-faint">Aranıyor...</p>}
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
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
              <motion.li key={note.id} layout={!reduced} initial={false} transition={rowTransition}>
                <button
                  onClick={() => setSelectedId(note.id)}
                  aria-pressed={isSelected}
                  className={`glass-soft w-full min-w-0 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isSelected ? 'ring-1 ring-accent/60' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="truncate text-sm text-ink">{note.title || 'Başlıksız not'}</div>
                  <div className="truncate text-xs text-faint">
                    {firstLine(note.content) || 'Boş not'}
                  </div>
                </button>
              </motion.li>
            )
          })}
        </ul>

        {error && <p className="border-t border-line p-3 text-xs text-negative">{error}</p>}
      </div>

      <div className="glass min-w-0 flex-1 overflow-hidden">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onDelete={() => setPendingDeleteId(selected.id)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-faint">
            <IconTile icon={FileText} tone="pink" size={38} />
            <p>
              {all.length > 0
                ? 'Soldan bir not seç.'
                : 'İlk notunu oluşturmak için "Yeni not" butonuna tıkla.'}
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Bu not silinsin mi?"
        tone="danger"
        confirmLabel="Sil"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (id !== null) void deleteNote(id)
        }}
      />
    </div>
  )
}

export default NotesView
