import { useState } from 'react'
import {
  ListTodo,
  MessageSquare,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  type LucideIcon
} from 'lucide-react'
import { PAGE_LABELS, type PageId } from '../lib/pages'

const ITEMS: { id: PageId; icon: LucideIcon }[] = [
  { id: 'chat', icon: MessageSquare },
  { id: 'tasks', icon: ListTodo },
  { id: 'notes', icon: NotebookPen },
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

interface SidebarProps {
  active: PageId
  onSelect: (page: PageId) => void
}

function Sidebar({ active, onSelect }: SidebarProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(readCollapsed)

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
      className={`flex shrink-0 flex-col border-r border-line bg-app py-3 transition-[width] duration-200 ${
        collapsed ? 'w-[60px] px-2' : 'w-[212px] px-3'
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
              className={`relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive ? 'bg-elevated text-ink' : 'text-muted hover:bg-elevated/60 hover:text-ink'
              }`}
            >
              {isActive && (
                <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{PAGE_LABELS[id]}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {!collapsed && <span className="px-1 text-xs text-faint">v0.8</span>}
        <button
          onClick={toggle}
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
