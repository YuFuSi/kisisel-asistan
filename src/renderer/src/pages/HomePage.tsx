import { History, MessageSquare, Square } from 'lucide-react'
import ActivityList from '../components/activity/ActivityList'
import CommandBox from '../components/home/CommandBox'
import HomeCard from '../components/home/HomeCard'
import QuickAccess from '../components/home/QuickAccess'
import QuoteCard from '../components/home/QuoteCard'
import SystemStatusCard from '../components/home/SystemStatusCard'
import Orb from '../components/jarvis/Orb'
import { STATE_LABELS, useAssistantState } from '../lib/assistantState'
import { useClock } from '../lib/deviceStatus'
import type { PageId } from '../lib/pages'
import { toggleVoiceSession, useVoice, type VoiceSnapshot } from '../lib/voiceClient'

interface HomePageProps {
  onNavigate: (page: PageId) => void
  /** Komut kutusundan gelen istek; yeni sohbette cevaplanır */
  onAsk: (text: string) => void
  /** Sesli sohbetin kaydedildiği sohbeti Asistan sayfasında açar */
  onOpenConversation: (conversationId: number) => void
}

function greeting(hour: number): string {
  if (hour < 5) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  if (hour < 22) return 'İyi akşamlar'
  return 'İyi geceler'
}

function voiceHint(voice: VoiceSnapshot): string {
  if (voice.sessionActive) {
    switch (voice.phase) {
      case 'capturing':
        return 'Dinliyorum... Bitirmek için “dur” de veya küreye dokun.'
      case 'transcribing':
        return 'Söylediğini yazıya çeviriyorum...'
      case 'responding':
        return 'Cevaplıyorum...'
    }
  }
  return voice.phase === 'wake'
    ? '“Hey Jarvis” de veya konuşmak için küreye dokun'
    : 'Konuşmak için küreye dokun'
}

// Jarvis ana ekranı: küre, komut kutusu, hızlı erişim ve sağda durum kartları
function HomePage({ onNavigate, onAsk, onOpenConversation }: HomePageProps): React.JSX.Element {
  const state = useAssistantState()
  const voice = useVoice()
  const now = useClock(60_000)
  const busy = state !== 'idle'
  const voiceError = voice.micError ?? voice.error
  const conversationId = voice.conversationId

  return (
    <div className="jarvis-backdrop h-full overflow-y-auto">
      <div className="mx-auto grid max-w-7xl gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col items-center">
          <button
            onClick={toggleVoiceSession}
            aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
            title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
            className="max-w-full cursor-pointer rounded-[40%] focus-visible:outline-offset-[-24px]"
          >
            <Orb state={state} size={220} />
          </button>
          <h1 className="-mt-2 text-4xl font-semibold tracking-tight text-ink">Jarvis</h1>
          <p className="mt-2 text-base text-muted">
            {greeting(now.getHours())}, nasıl yardımcı olabilirim?
          </p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulse bg-glow' : 'bg-positive'}`}
            />
            {STATE_LABELS[state]}
          </span>
          <p className="mt-2 text-xs text-faint">{voiceHint(voice)}</p>

          {(voice.userCaption || voice.assistantCaption) && (
            <div className="glass-card animate-fade mt-5 w-full max-w-2xl space-y-2 p-4 text-sm">
              {voice.userCaption && (
                <p className="select-text">
                  <span className="text-faint">Sen: </span>
                  <span className="text-ink">{voice.userCaption}</span>
                </p>
              )}
              {voice.assistantCaption && (
                <p className="select-text">
                  <span className="text-glow">Jarvis: </span>
                  <span className="text-muted">{voice.assistantCaption}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-4 pt-1">
                {conversationId !== null && (
                  <button
                    onClick={() => onOpenConversation(conversationId)}
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Sohbette aç
                  </button>
                )}
                {voice.sessionActive && (
                  <button
                    onClick={toggleVoiceSession}
                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Sesli sohbeti bitir
                  </button>
                )}
              </div>
            </div>
          )}
          {voiceError && (
            <p className="mt-3 max-w-2xl text-center text-xs text-negative select-text">
              {voiceError}
            </p>
          )}

          <div className="mt-8 flex w-full justify-center">
            <CommandBox onSubmit={onAsk} />
          </div>
          <div className="mt-12 w-full">
            <QuickAccess onNavigate={onNavigate} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <HomeCard title="Son işlemler" icon={History}>
            <ActivityList limit={5} compact />
          </HomeCard>
          <SystemStatusCard />
          <QuoteCard date={now} />
        </aside>
      </div>
    </div>
  )
}

export default HomePage
