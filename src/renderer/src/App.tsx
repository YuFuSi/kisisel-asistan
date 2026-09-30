import { useEffect, useState } from 'react'
import CommandPalette from './components/CommandPalette'
import Sidebar from './components/Sidebar'
import { PAGE_LABELS, type PageId } from './lib/pages'
import TitleBar from './components/TitleBar'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import PlanningPage, { type PlanningTab } from './pages/PlanningPage'
import CalendarPage from './pages/CalendarPage'
import NotesPage from './pages/NotesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import GesturesPage from './pages/GesturesPage'
import SettingsPage from './pages/SettingsPage'
import { requestNewChat, requestOpenConversation } from './lib/chatRequests'
import { focusComposer } from './lib/dom'
import { initVoiceClient, toggleVoiceSession } from './lib/voiceClient'
import VoiceEscapeBoundary from './components/ui/VoiceEscapeBoundary'
import VoiceOverlay from './components/jarvis/VoiceOverlay'
import ApprovalDock from './components/jarvis/ApprovalDock'
import { noteNotification } from './lib/assistantState'

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('home')
  const [planningTab, setPlanningTab] = useState<PlanningTab>('tasks')
  const [paletteOpen, setPaletteOpen] = useState(false)
  // El ile kontrol açıkken sürükleyici (Iron Man tarzı) görünüm için sidebar gizlenir
  const [handControlOn, setHandControlOn] = useState(false)

  // Ctrl+K (veya Cmd+K) her yerden komut paletini açar
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Ctrl+Space: hangi sayfada olursa olsun Jarvis'le konuşmayı başlatır/bitirir
      if (e.ctrlKey && !e.shiftKey && e.code === 'Space') {
        e.preventDefault()
        toggleVoiceSession()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
        setPlanningTab('tasks')
        setPage('tasks')
        return
      }
      if (command === 'open-automations') {
        navigate('automations')
        return
      }
      if (command.startsWith('open-page:')) {
        const target = command.slice('open-page:'.length)
        // Bilinmeyen bir kimlik boş sayfa göstermesin
        if (target in PAGE_LABELS) navigate(target as PageId)
        return
      }
      setPage('chat')
      focusComposer()
    })
  }, [])

  // Tasarım turunda birleştirilen sayfaların eski kimlikleri yeni yerlerine gider: Otomasyonlar →
  // Planlama'nın Rutinler sekmesi, Başarımlar → Analizler. Bildirim, komut paleti ve yörünge
  // hâlâ eski kimlikleri kullanabildiği için hiçbir bağlantı kırılmaz.
  function navigate(target: PageId): void {
    if (target === 'automations') {
      setPlanningTab('routines')
      setPage('tasks')
      return
    }
    if (target === 'achievements') {
      setPage('analytics')
      return
    }
    setPage(target)
  }

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
      <TitleBar page={PAGE_LABELS[page]} showOrb={page !== 'home'} />

      <div className="flex min-h-0 flex-1">
        {!handControlOn && <Sidebar active={page} onSelect={navigate} />}
        <main className="relative min-w-0 flex-1 bg-surface">
          {page !== 'home' && (
            <>
              <VoiceEscapeBoundary />
              <VoiceOverlay onOpenConversation={openConversation} />
            </>
          )}
          <ApprovalDock onOpenConversation={openConversation} />
          {page === 'home' && (
            <div className="animate-fade h-full">
              <HomePage
                onNavigate={navigate}
                onAsk={ask}
                onOpenConversation={openConversation}
                handControlOn={handControlOn}
                onHandControlChange={setHandControlOn}
              />
            </div>
          )}
          {/* Sohbet sayfası hep açık kalır; cevap yazılırken sayfa değiştirilse de akış kaybolmaz */}
          <div className="h-full" hidden={page !== 'chat'}>
            <ChatPage active={page === 'chat'} onOpenSettings={() => setPage('settings')} />
          </div>
          {page === 'tasks' && (
            <div className="animate-fade h-full overflow-y-auto">
              <PlanningPage tab={planningTab} onTabChange={setPlanningTab} />
            </div>
          )}
          {page === 'calendar' && (
            <div className="animate-fade h-full overflow-y-auto">
              <CalendarPage onOpenSettings={() => setPage('settings')} />
            </div>
          )}
          {page === 'notes' && (
            <div className="animate-fade h-full">
              <NotesPage
                onOpenSettings={() => setPage('settings')}
                onOpenConversation={openConversation}
              />
            </div>
          )}
          {page === 'analytics' && (
            <div className="animate-fade h-full overflow-y-auto">
              <AnalyticsPage />
            </div>
          )}
          {page === 'gestures' && (
            <div className="animate-fade h-full overflow-y-auto">
              <GesturesPage onNavigate={navigate} />
            </div>
          )}
          {page === 'settings' && (
            <div className="animate-fade h-full overflow-y-auto">
              <SettingsPage />
            </div>
          )}
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          currentPage={page}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

export default App
