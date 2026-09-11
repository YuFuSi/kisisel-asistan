import { useState } from 'react'
import Sidebar, { type PageId } from './components/Sidebar'
import ComingSoon from './components/ComingSoon'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('chat')

  return (
    <div className="flex h-full">
      <Sidebar active={page} onSelect={setPage} />
      <main className="min-w-0 flex-1">
        {/* Sohbet sayfası hep açık kalır; cevap yazılırken sayfa değiştirilse de akış kaybolmaz */}
        <div className="h-full" hidden={page !== 'chat'}>
          <ChatPage active={page === 'chat'} onOpenSettings={() => setPage('settings')} />
        </div>
        {page === 'tasks' && (
          <ComingSoon title="Görevler" description="Yapılacaklar ve hatırlatmalar" stage={2} />
        )}
        {page === 'notes' && (
          <ComingSoon title="Notlar" description="Notların ve asistanın hafızası" stage={2} />
        )}
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
