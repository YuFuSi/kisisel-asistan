import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Note } from '@shared/api'
import { errorMessage } from '../../lib/errors'

interface NoteEditorProps {
  note: Note
  onDelete: () => void
}

const SAVE_DELAY_MS = 600

// Başka bir not seçilince sıfırlanması için key={note.id} ile kullanılır
function NoteEditor({ note, onDelete }: NoteEditorProps): React.JSX.Element {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [error, setError] = useState<string | null>(null)
  const dirty = title !== note.title || content !== note.content

  // Yazmayı bıraktıktan kısa süre sonra otomatik kaydet
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      window.api.notes
        .update(note.id, { title, content })
        .catch((err) => setError(errorMessage(err)))
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [dirty, note.id, title, content])

  // Başka bir yere tıklanınca (ör. başka not seçilince) bekleyen değişikliği hemen kaydet
  function flush(): void {
    if (!dirty) return
    window.api.notes.update(note.id, { title, content }).catch((err) => setError(errorMessage(err)))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={flush}
          placeholder="Başlık"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-faint"
        />
        <span className="shrink-0 text-xs text-faint">
          {dirty ? 'Kaydediliyor...' : 'Kaydedildi'}
        </span>
        <button
          onClick={onDelete}
          aria-label="Notu sil"
          title="Notu sil"
          className="rounded p-1.5 text-faint transition-colors hover:text-negative"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={flush}
        placeholder="Notunu yaz..."
        className="flex-1 resize-none bg-transparent px-6 py-4 text-sm leading-7 text-ink outline-none placeholder:text-faint"
      />
      {error && <p className="px-6 pb-3 text-sm text-negative select-text">{error}</p>}
    </div>
  )
}

export default NoteEditor
