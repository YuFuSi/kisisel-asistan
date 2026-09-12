import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import { PAGE_LABELS, type PageId } from './lib/pages'
import TitleBar from './components/TitleBar'
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
    <div className="flex h-full flex-col bg-app">
      <TitleBar page={PAGE_LABELS[page]} />

      <div className="flex min-h-0 flex-1">
        <Sidebar active={page} onSelect={setPage} />
        <main className="min-w-0 flex-1 bg-surface">
          {/* Sohbet sayfası hep açık kalır; cevap yazılırken sayfa değiştirilse de akış kaybolmaz */}
          <div className="h-full" hidden={page !== 'chat'}>
            <ChatPage active={page === 'chat'} onOpenSettings={() => setPage('settings')} />
          </div>
          {page === 'tasks' && (
            <div className="animate-fade h-full overflow-y-auto">
              <TasksPage />
            </div>
          )}
          {page === 'notes' && (
            <div className="animate-fade h-full">
              <NotesPage />
            </div>
          )}
          {page === 'settings' && (
            <div className="animate-fade h-full overflow-y-auto">
              <SettingsPage />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
