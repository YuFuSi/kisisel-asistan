import { useState } from 'react'
import NotesView from '../components/notes/NotesView'
import MemoriesView from '../components/notes/MemoriesView'
import { tabClass } from '../lib/styles'

type Tab = 'notes' | 'memories'

const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notlarım' },
  { id: 'memories', label: 'Asistanın hafızası' }
]

function NotesPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('notes')

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line px-8 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Hafıza Merkezi</h1>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={tabClass(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1">{tab === 'notes' ? <NotesView /> : <MemoriesView />}</div>
    </div>
  )
}

export default NotesPage
