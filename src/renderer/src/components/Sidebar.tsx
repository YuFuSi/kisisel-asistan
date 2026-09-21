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
  Trophy,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import { STATE_LABELS, useAssistantState } from '../lib/assistantState'
import { PAGE_LABELS, type PageId } from '../lib/pages'

const ITEMS: { id: PageId; icon: LucideIcon }[] = [
  { id: 'home', icon: House },
  { id: 'chat', icon: MessageSquare },
  { id: 'tasks', icon: ListTodo },
  { id: 'calendar', icon: CalendarDays },
  { id: 'notes', icon: Brain },
  { id: 'automations', icon: Workflow },
  { id: 'analytics', icon: BarChart3 },
  { id: 'achievements', icon: Trophy },
  { id: 'settings', icon: Settings }
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
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const version = useAppVersion()
  const assistant = useAssistantState()
  const busy = assistant !== 'idle'

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
      className={`flex shrink-0 flex-col border-r border-line bg-app py-4 transition-[width] duration-200 ${
        collapsed ? 'w-[64px] px-2' : 'w-[232px] px-3'
      }`}
    >
      <nav className="flex flex-col gap-1">
        {ITEMS.map(({ id, icon: Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              title={collapsed ? PAGE_LABELS[id] : undefined}
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

      <div className="mt-auto space-y-3 pt-3">
        <div
          className={`flex items-center gap-2.5 border-t border-line pt-3 ${collapsed ? 'justify-center' : 'px-2'}`}
          title={collapsed ? STATE_LABELS[assistant] : undefined}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${busy ? 'animate-pulse bg-accent' : 'bg-positive'}`}
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className={`truncate text-xs ${busy ? 'text-accent' : 'text-muted'}`}>
                {busy ? `${STATE_LABELS[assistant]}...` : 'Sistem hazır'}
              </div>
              <div className="truncate text-[11px] text-faint">Her zaman yanında</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {!collapsed && version && <span className="px-2 text-xs text-faint">v{version}</span>}
          <button
            onClick={toggle}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink ${collapsed ? 'mx-auto' : ''}`}
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
