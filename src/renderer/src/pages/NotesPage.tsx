import { useState } from 'react'
import NotesView from '../components/notes/NotesView'
import MemoriesView from '../components/notes/MemoriesView'
import MemoryGraph from '../components/notes/MemoryGraph'
import { tabClass } from '../lib/styles'

type Tab = 'notes' | 'memories'
type View = 'list' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notlarım' },
  { id: 'memories', label: 'Asistanın hafızası' }
]

interface NotesPageProps {
  onOpenSettings: () => void
}

function NotesPage({ onOpenSettings }: NotesPageProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('notes')
  const [view, setView] = useState<View>('list')

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line px-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Hafıza Merkezi</h1>
          <div className="flex gap-1">
            <button onClick={() => setView('list')} className={tabClass(view === 'list')}>
              Liste
            </button>
            <button onClick={() => setView('graph')} className={tabClass(view === 'graph')}>
              Harita
            </button>
          </div>
        </div>
        {view === 'list' && (
          <div className="mt-4 flex gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={tabClass(tab === t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {view === 'graph' ? (
          <MemoryGraph onOpenSettings={onOpenSettings} />
        ) : tab === 'notes' ? (
          <NotesView />
        ) : (
          <MemoriesView />
        )}
      </div>
    </div>
  )
}

export default NotesPage
