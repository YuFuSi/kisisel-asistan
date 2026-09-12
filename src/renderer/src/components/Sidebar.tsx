import {
  ListTodo,
  MessageSquare,
  NotebookPen,
  Settings,
  Sparkles,
  type LucideIcon
} from 'lucide-react'

export type PageId = 'chat' | 'tasks' | 'notes' | 'settings'

const items: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'chat', label: 'Sohbet', icon: MessageSquare },
  { id: 'tasks', label: 'Görevler', icon: ListTodo },
  { id: 'notes', label: 'Notlar', icon: NotebookPen },
  { id: 'settings', label: 'Ayarlar', icon: Settings }
]

interface SidebarProps {
  active: PageId
  onSelect: (page: PageId) => void
}

function Sidebar({ active, onSelect }: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold tracking-tight">Kişisel Asistan</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active === id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto px-3 text-xs text-zinc-600">v0.6 · Aşama 5</div>
    </aside>
  )
}

export default Sidebar
