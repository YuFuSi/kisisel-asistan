import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3,
  Brain,
  CalendarDays,
  Hand,
  House,
  ListTodo,
  MessageSquare,
  MessageSquarePlus,
  Search,
  Settings,
  Sun,
  Trophy,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import { requestOpenConversation, requestBlankChat, requestNewChat } from '../lib/chatRequests'
import { filterCommands, type Command } from '../lib/commandPalette'
import { focusConversationSearch } from '../lib/dom'
import { PAGE_LABELS, type PageId } from '../lib/pages'
import { useDismissLayer } from '../lib/useDismissLayer'
import { useDialogFocus } from '../lib/useDialogFocus'
import { useLiveData } from '../lib/useLiveData'
import type { Conversation } from '@shared/api'
const loadConversations = (): Promise<Conversation[]> => window.api.conversations.list()

const PAGE_ICONS: Record<PageId, LucideIcon> = {
  home: House,
  chat: MessageSquare,
  tasks: ListTodo,
  calendar: CalendarDays,
  notes: Brain,
  automations: Workflow,
  analytics: BarChart3,
  achievements: Trophy,
  gestures: Hand,
  settings: Settings
}

interface PaletteCommand extends Command {
  icon: LucideIcon
  run: () => void
}

interface CommandPaletteProps {
  onClose: () => void
  currentPage: PageId
  onNavigate: (page: PageId) => void
}

// Ctrl+K ile açılan, klavyeyle sürülen komut paleti: sayfalara ve sık işlemlere anında ulaşır.
// Sadece açıkken App tarafından render edilir (bkz. App.tsx); böylece her açılışta taze bir
// bileşen örneği olur ve arama metni/seçim sıfırlamak için effect içinde setState gerekmez.
function CommandPalette({
  onClose,
  currentPage,
  onNavigate
}: CommandPaletteProps): React.JSX.Element {
  const conversations = useLiveData(loadConversations, 'conversations').data
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useDismissLayer(true, 50, onClose)
  useDialogFocus(true, panelRef)

  const commands = useMemo<PaletteCommand[]>(() => {
    const pages = (Object.keys(PAGE_LABELS) as PageId[])
      .filter(
        (id) => id !== currentPage && !['automations', 'achievements', 'gestures'].includes(id)
      )
      .map((id) => ({
        id: `page-${id}`,
        label: PAGE_LABELS[id],
        group: 'Alanlar',
        keywords: 'git sayfa',
        icon: PAGE_ICONS[id],
        run: () => onNavigate(id)
      }))

    const actions: PaletteCommand[] = [
      {
        id: 'new-chat',
        label: 'Yeni sohbet',
        group: 'Eylemler',
        icon: MessageSquarePlus,
        run: () => {
          onNavigate('chat')
          requestBlankChat()
        }
      },
      {
        id: 'daily-brief',
        label: 'Günümü özetle',
        group: 'Eylemler',
        keywords: 'günlük özet',
        icon: Sun,
        run: () => {
          onNavigate('chat')
          requestNewChat('Günlük özetimi hazırla.')
        }
      },
      {
        id: 'search-chat',
        label: 'Sohbetlerde ara',
        group: 'Eylemler',
        keywords: 'arama bul',
        icon: Search,
        run: () => {
          onNavigate('chat')
          focusConversationSearch()
        }
      }
    ]

    const history: PaletteCommand[] = (conversations ?? []).slice(0, 8).map((conversation) => ({
      id: `conversation-${conversation.id}`,
      label: conversation.title || 'Adsız sohbet',
      group: 'Geçmiş',
      icon: MessageSquare,
      run: () => {
        onNavigate('chat')
        requestOpenConversation(conversation.id)
      }
    }))
    return [...actions, ...pages, ...history]
  }, [currentPage, onNavigate, conversations])

  const filtered = useMemo(() => {
    const matches = filterCommands(commands, query)
    if (matches.length || !query.trim()) return matches
    return [
      {
        id: 'ask-jarvis',
        label: `Bunu Pıtır'a sor: ${query.trim()}`,
        group: 'Eylemler',
        icon: MessageSquare,
        run: () => {
          onNavigate('chat')
          requestNewChat(query.trim())
        }
      }
    ]
  }, [commands, query, onNavigate])
  // Filtre değişince seçim sınırın dışında kalmasın (sıfırlamak için ayrı bir effect gerekmez)
  const activeIndex = Math.min(selected, Math.max(filtered.length - 1, 0))
  const rows = useMemo(
    () =>
      filtered.reduce<{ command: PaletteCommand; showGroup: boolean }[]>((acc, command) => {
        const previousGroup = acc.at(-1)?.command.group
        acc.push({ command, showGroup: command.group !== previousGroup })
        return acc
      }, []),
    [filtered]
  )

  useEffect(() => {
    panelRef.current
      ?.querySelector('[data-palette-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filtered])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || !panelRef.current?.contains(e.target as Node)) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && e.target === inputRef.current) {
        e.preventDefault()
        const command = filtered[activeIndex]
        if (command) {
          onClose()
          command.run()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtered, activeIndex, onClose])

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-app/70 pt-[16vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        tabIndex={-1}
        className="card animate-enter w-full max-w-lg overflow-hidden p-0 shadow-float"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            aria-label="Komut ara"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Sayfaya git ya da bir işlem ara..."
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-faint">Eşleşme yok.</p>
          )}
          {rows.map(({ command, showGroup }, i) => {
            const Icon = command.icon
            return (
              <div key={command.id}>
                {showGroup && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
                    {command.group}
                  </div>
                )}
                <button
                  data-palette-active={i === activeIndex}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => {
                    onClose()
                    command.run()
                  }}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition-colors ${
                    i === activeIndex ? 'bg-elevated text-ink' : 'text-muted'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-accent" />
                  {command.label}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default CommandPalette
