import { useEffect, useState } from 'react'
import {
  BarChart3,
  Brain,
  CalendarDays,
  House,
  ListTodo,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  type LucideIcon
} from 'lucide-react'
import { PAGE_LABELS, type PageId } from '../lib/pages'
import { useNarrowWindow } from '../lib/useNarrowWindow'
import { useAssistantState } from '../lib/assistantState'

// Tasarım turu: 9 sayfa 6'ya indi (Otomasyonlar → Planlama > Rutinler, Başarımlar → Analizler).
// Ayarlar ana listede değil, menünün en altında.
const ITEMS: { id: PageId; icon: LucideIcon }[] = [
  { id: 'home', icon: House },
  { id: 'chat', icon: MessageSquare },
  { id: 'tasks', icon: ListTodo },
  { id: 'calendar', icon: CalendarDays },
  { id: 'notes', icon: Brain },
  { id: 'analytics', icon: BarChart3 }
]

const STORAGE_KEY = 'sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// package.json'daki sürüm; menünün altında gösterilir
function useAppVersion(): string {
  const [version, setVersion] = useState('')
  useEffect(() => {
    window.api.app.version().then(setVersion, () => setVersion(''))
  }, [])
  return version
}

interface SidebarProps {
  active: PageId
  onSelect: (page: PageId) => void
}

function Sidebar({ active, onSelect }: SidebarProps): React.JSX.Element {
  const [manualCollapsed, setCollapsed] = useState(readCollapsed)
  const narrow = useNarrowWindow()
  const collapsed = narrow || manualCollapsed
  const state = useAssistantState()
  const version = useAppVersion()
  function toggle(): void {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Depolama kapalıysa ayar sadece bu oturum için geçerli olur
    }
  }

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-black/10 py-4 transition-[width] duration-200 ${
        collapsed ? 'w-[64px] px-2' : 'w-[264px] px-3'
      }`}
    >
      <nav className="flex flex-col gap-1">
        {ITEMS.map(({ id, icon: Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              title={PAGE_LABELS[id]}
              aria-label={PAGE_LABELS[id]}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-[10px] text-sm transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive
                  ? 'bg-elevated font-medium text-ink'
                  : 'text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {isActive && (
                <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-accent" />
              )}
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-accent' : ''}`} />
              {!collapsed && <span className="truncate">{PAGE_LABELS[id]}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-line pt-3">
        {['thinking', 'working', 'approval'].includes(state) && (
          <p
            role="status"
            title="Bir işlem sürüyor"
            className="min-h-8 px-2 py-2 text-xs text-muted"
          >
            {collapsed ? '•' : 'Bir işlem sürüyor'}
          </p>
        )}
        <button
          onClick={() => onSelect('settings')}
          title={PAGE_LABELS.settings}
          aria-label={PAGE_LABELS.settings}
          aria-current={active === 'settings' ? 'page' : undefined}
          className={`flex h-9 w-full items-center gap-3 rounded-[10px] text-sm transition-colors ${
            collapsed ? 'justify-center px-0' : 'px-3'
          } ${
            active === 'settings'
              ? 'bg-elevated font-medium text-ink'
              : 'text-muted hover:bg-surface hover:text-ink'
          }`}
        >
          <Settings
            className={`h-[18px] w-[18px] shrink-0 ${active === 'settings' ? 'text-accent' : ''}`}
          />
          {!collapsed && <span>{PAGE_LABELS.settings}</span>}
        </button>

        <div className="flex items-center justify-between gap-2">
          {!collapsed && version && <span className="px-2 text-xs text-faint">v{version}</span>}
          <button
            onClick={toggle}
            disabled={narrow}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`min-h-8 min-w-8 rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
