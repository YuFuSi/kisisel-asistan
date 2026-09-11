import { useState } from 'react'
import Sidebar, { type PageId } from './components/Sidebar'
import ComingSoon from './components/ComingSoon'
import ChatPage from './pages/ChatPage'

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('chat')

  return (
    <div className="flex h-full">
      <Sidebar active={page} onSelect={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === 'chat' && <ChatPage />}
        {page === 'tasks' && (
          <ComingSoon title="Görevler" description="Yapılacaklar ve hatırlatmalar" stage={2} />
        )}
        {page === 'notes' && (
          <ComingSoon title="Notlar" description="Notların ve asistanın hafızası" stage={2} />
        )}
        {page === 'settings' && (
          <ComingSoon title="Ayarlar" description="Yapay zeka sağlayıcısı ve tercihler" stage={1} />
        )}
      </main>
    </div>
  )
}

export default App
