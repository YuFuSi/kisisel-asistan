import { useEffect, useRef, useState } from 'react'
import {
  Download,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X
} from 'lucide-react'
import type { ConversationSearchResult } from '@shared/api'
import { CONVERSATION_SEARCH_ID } from '../../lib/dom'

interface ConversationListProps {
  results: ConversationSearchResult[]
  activeId: number | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (id: number) => void
  onNew: () => void
  onDelete: (id: number) => void
  onRename: (id: number, title: string) => void
  onPin: (id: number, pinned: boolean) => void
  onExport: (id: number) => void
}

interface RowMenuProps {
  pinned: boolean
  onRename: () => void
  onPin: () => void
  onExport: () => void
  onDelete: () => void
}

const menuItemClass =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted transition-colors hover:bg-line/60 hover:text-ink'

// Sohbet satırındaki "..." menüsü
function RowMenu({ pinned, onRename, onPin, onExport, onDelete }: RowMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Menü dışına tıklanınca veya Esc'e basılınca kapansın
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (action: () => void) => (): void => {
    setOpen(false)
    action()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Sohbet menüsü"
        title="Diğer işlemler"
        className={`mr-1 rounded-md p-1.5 text-faint transition hover:bg-line/60 hover:text-ink ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="animate-fade absolute right-1 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-lg">
          <button onClick={run(onRename)} className={menuItemClass}>
            <Pencil className="h-3.5 w-3.5" />
            Yeniden adlandır
          </button>
          <button onClick={run(onPin)} className={menuItemClass}>
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          </button>
          <button onClick={run(onExport)} className={menuItemClass}>
            <Download className="h-3.5 w-3.5" />
            Markdown olarak kaydet
          </button>
          <button
            onClick={run(onDelete)}
            className={`${menuItemClass} hover:text-negative`}
            data-testid="menu-delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Sil
          </button>
        </div>
      )}
    </div>
  )
}

function ConversationList({
  results,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onPin,
  onExport
}: ConversationListProps): React.JSX.Element {
  // Adı düzenlenen sohbet
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function startRename(id: number, title: string): void {
    setEditingId(id)
    setDraft(title)
  }

  function commitRename(): void {
    if (editingId === null) return
    const title = draft.trim()
    const current = results.find((r) => r.conversation.id === editingId)?.conversation
    if (title && title !== current?.title) onRename(editingId, title)
    setEditingId(null)
  }

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-line">
      <div className="space-y-2 p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Yeni sohbet
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 transition-colors focus-within:border-line-strong">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
          <input
            id={CONVERSATION_SEARCH_ID}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation()
                onQueryChange('')
              }
            }}
            placeholder="Sohbetlerde ara"
            className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              aria-label="Aramayı temizle"
              className="shrink-0 rounded text-faint transition-colors hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {results.length === 0 ? (
          <p className="px-3 py-2 text-xs text-faint">
            {query ? 'Eşleşen sohbet yok.' : 'Henüz sohbet yok.'}
          </p>
        ) : (
          results.map(({ conversation, snippet }) => {
            const isActive = conversation.id === activeId
            const title = conversation.title || 'Yeni sohbet'

            if (conversation.id === editingId) {
              return (
                <div key={conversation.id} className="px-1 py-1">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setEditingId(null)
                      }
                    }}
                    aria-label="Sohbet adı"
                    className="w-full rounded-md border border-accent/70 bg-surface px-2 py-1.5 text-sm text-ink outline-none"
                  />
                </div>
              )
            }

            return (
              <div
                key={conversation.id}
                className={`group flex items-start rounded-lg ${isActive ? 'bg-elevated' : 'hover:bg-elevated/60'}`}
              >
                <button
                  onClick={() => onSelect(conversation.id)}
                  onDoubleClick={() => startRename(conversation.id, conversation.title)}
                  title={title}
                  className="min-w-0 flex-1 px-3 py-2 text-left"
                >
                  <span
                    className={`flex items-center gap-1.5 text-sm ${isActive ? 'text-ink' : 'text-muted'}`}
                  >
                    {conversation.pinned && (
                      <Pin className="h-3 w-3 shrink-0 fill-current text-accent" />
                    )}
                    <span className="truncate">{title}</span>
                  </span>
                  {snippet && (
                    <span className="mt-0.5 block truncate text-xs text-faint">{snippet}</span>
                  )}
                </button>
                <RowMenu
                  pinned={conversation.pinned}
                  onRename={() => startRename(conversation.id, conversation.title)}
                  onPin={() => onPin(conversation.id, !conversation.pinned)}
                  onExport={() => onExport(conversation.id)}
                  onDelete={() => onDelete(conversation.id)}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ConversationList
