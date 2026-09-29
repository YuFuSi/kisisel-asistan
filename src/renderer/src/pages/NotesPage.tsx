import { useState } from 'react'
import NotesView from '../components/notes/NotesView'
import MemoriesView from '../components/notes/MemoriesView'
import MemoryGraph from '../components/notes/MemoryGraph'
import PageLayout from '../components/ui/PageLayout'
import Tabs, { type TabItem } from '../components/ui/Tabs'

// Hafıza: tek sekme sırası (tasarım turu). Eskiden Liste/Harita ve Notlarım/Asistanın hafızası
// diye iki kat sekme vardı. İlk açılışta Jarvis'in bildikleri gelir: sayfanın asıl işi bu.
type Tab = 'memories' | 'notes' | 'graph'

const TABS: TabItem<Tab>[] = [
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
    <PageLayout title="Hafıza" fill tabs={<Tabs items={TABS} value={tab} onChange={setTab} />}>
      {tab === 'graph' ? (
        <MemoryGraph onOpenSettings={onOpenSettings} />
      ) : tab === 'notes' ? (
        <NotesView />
      ) : (
        <MemoriesView onOpenConversation={onOpenConversation} />
      )}
    </PageLayout>
  )
}

export default NotesPage
