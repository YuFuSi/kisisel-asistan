import { useEffect, useState } from 'react'
import Sidebar, { type PageId } from './components/Sidebar'
import ChatPage from './pages/ChatPage'
import TasksPage from './pages/TasksPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import { focusComposer } from './lib/dom'

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('chat')

  // Global kısayol veya tepsi menüsünden gelince sohbet sayfasına geç ve yazı kutusuna odaklan
  useEffect(() => {
    return window.api.events.onCommand(() => {
      setPage('chat')
      focusComposer()
    })
  }, [])

  return (
    <div className="flex h-full">
      <Sidebar active={page} onSelect={setPage} />
      <main className="min-w-0 flex-1">
        {/* Sohbet sayfası hep açık kalır; cevap yazılırken sayfa değiştirilse de akış kaybolmaz */}
        <div className="h-full" hidden={page !== 'chat'}>
          <ChatPage active={page === 'chat'} onOpenSettings={() => setPage('settings')} />
        </div>
        {page === 'tasks' && (
          <div className="h-full overflow-y-auto">
            <TasksPage />
          </div>
        )}
        {page === 'notes' && <NotesPage />}
        {page === 'settings' && (
          <div className="h-full overflow-y-auto">
            <SettingsPage />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
