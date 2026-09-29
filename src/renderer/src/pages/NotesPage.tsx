import { useState } from 'react'
import NotesView from '../components/notes/NotesView'
import MemoriesView from '../components/notes/MemoriesView'
import MemoryGraph from '../components/notes/MemoryGraph'
import { tabClass } from '../lib/styles'

// Hafıza: tek sekme sırası (tasarım turu). Eskiden Liste/Harita ve Notlarım/Asistanın hafızası
// diye iki kat sekme vardı. İlk açılışta Jarvis'in bildikleri gelir: sayfanın asıl işi bu.
type Tab = 'memories' | 'notes' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'memories', label: "Jarvis'in bildikleri" },
  { id: 'notes', label: 'Notlarım' },
  { id: 'graph', label: 'Harita' }
]

interface NotesPageProps {
  onOpenConversation?: (conversationId: number) => void
  onOpenSettings: () => void
}

function NotesPage({ onOpenSettings, onOpenConversation }: NotesPageProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('memories')

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line px-8 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Hafıza</h1>
        <div className="mt-4 flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={tabClass(tab === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {tab === 'graph' ? (
          <MemoryGraph onOpenSettings={onOpenSettings} />
        ) : tab === 'notes' ? (
          <NotesView />
        ) : (
          <MemoriesView onOpenConversation={onOpenConversation} />
        )}
      </div>
    </div>
  )
}

export default NotesPage
