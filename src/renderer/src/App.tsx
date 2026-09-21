import { useEffect, useState } from 'react'
import { BarChart3, Trophy } from 'lucide-react'
import Sidebar from './components/Sidebar'
import { PAGE_LABELS, type PageId } from './lib/pages'
import TitleBar from './components/TitleBar'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import TasksPage from './pages/TasksPage'
import CalendarPage from './pages/CalendarPage'
import NotesPage from './pages/NotesPage'
import AutomationsPage from './pages/AutomationsPage'
import ComingSoonPage from './pages/ComingSoonPage'
import SettingsPage from './pages/SettingsPage'
import { requestNewChat, requestOpenConversation } from './lib/chatRequests'
import { focusComposer } from './lib/dom'
import { initVoiceClient } from './lib/voiceClient'
import { noteNotification } from './lib/assistantState'

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('home')

  // Jarvis sesi: sesli sohbet olaylarını dinle, gerekirse mikrofonu aç
  useEffect(() => initVoiceClient(), [])

  // Global kısayol, tepsi menüsü veya bir bildirime tıklanınca gelen komutlar
  useEffect(() => {
    return window.api.events.onCommand((command) => {
      if (command === 'notified') {
        noteNotification()
        return
      }
      if (command === 'open-tasks') {
        setPage('tasks')
        return
      }
      if (command === 'open-automations') {
        setPage('automations')
        return
      }
      setPage('chat')
      focusComposer()
    })
  }, [])

  // Ana Sayfa'daki komut kutusu: sohbet sayfasına geç, istek yeni sohbette cevaplansın
  function ask(text: string): void {
    setPage('chat')
    requestNewChat(text)
  }

  function openConversation(conversationId: number): void {
    setPage('chat')
    requestOpenConversation(conversationId)
  }

  return (
    <div className="flex h-full flex-col bg-app">
      <TitleBar page={PAGE_LABELS[page]} />

      <div className="flex min-h-0 flex-1">
        <Sidebar active={page} onSelect={setPage} />
        <main className="min-w-0 flex-1 bg-surface">
          {page === 'home' && (
            <div className="animate-fade h-full">
              <HomePage onNavigate={setPage} onAsk={ask} onOpenConversation={openConversation} />
            </div>
          )}
          {/* Sohbet sayfası hep açık kalır; cevap yazılırken sayfa değiştirilse de akış kaybolmaz */}
          <div className="h-full" hidden={page !== 'chat'}>
            <ChatPage active={page === 'chat'} onOpenSettings={() => setPage('settings')} />
          </div>
          {page === 'tasks' && (
            <div className="animate-fade h-full overflow-y-auto">
              <TasksPage />
            </div>
          )}
          {page === 'calendar' && (
            <div className="animate-fade h-full overflow-y-auto">
              <CalendarPage onOpenSettings={() => setPage('settings')} />
            </div>
          )}
          {page === 'notes' && (
            <div className="animate-fade h-full">
              <NotesPage />
            </div>
          )}
          {page === 'automations' && (
            <div className="animate-fade h-full overflow-y-auto">
              <AutomationsPage />
            </div>
          )}
          {page === 'analytics' && (
            <div className="animate-fade h-full overflow-y-auto">
              <ComingSoonPage
                icon={BarChart3}
                title="Analizler"
                description="Asistan kullanımın hakkında istatistikler."
                bullets={[
                  'Tamamlanan görevler, en çok kullanılan araçlar',
                  'Otomasyonların kazandırdığı tahmini süre',
                  'Haftalık kullanım özeti'
                ]}
              />
            </div>
          )}
          {page === 'achievements' && (
            <div className="animate-fade h-full overflow-y-auto">
              <ComingSoonPage
                icon={Trophy}
                title="Başarımlar"
                description="Düzenli kullanım için küçük kutlamalar."
                bullets={[
                  '7 gün üst üste görev tamamlama gibi seriler',
                  'İlk rutin, 100. komut gibi rozetler',
                  'Tamamı yerel veriden hesaplanır, dışarı bir şey gitmez'
                ]}
              />
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
