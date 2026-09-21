import { History, MessageSquare, Square } from 'lucide-react'
import ActivityList from '../components/activity/ActivityList'
import CommandBox from '../components/home/CommandBox'
import HomeCard from '../components/home/HomeCard'
import QuickAccess from '../components/home/QuickAccess'
import SystemStatusCard from '../components/home/SystemStatusCard'
import Orb from '../components/jarvis/Orb'
import { StatusDot } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-8 pt-10 pb-12">
        <button
          onClick={toggleVoiceSession}
          aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
          title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
          className="max-w-full cursor-pointer rounded-full focus-visible:outline-offset-[-24px]"
        >
          <Orb state={state} size={260} />
        </button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          {greeting(now.getHours())}
        </h1>
        <p className="mt-2 text-base text-muted">Nasıl yardımcı olabilirim?</p>
        <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted">
          <StatusDot level={busy ? 'active' : 'ok'} pulse={busy} className="h-1.5 w-1.5" />
          {STATE_LABELS[state]}
        </span>
        <p className="mt-1 text-xs text-faint">{voiceHint(voice)}</p>

        {(voice.userCaption || voice.assistantCaption) && (
          <Card padding="sm" className="animate-fade mt-5 w-full max-w-2xl space-y-2 px-4 text-sm">
            {voice.userCaption && (
              <p className="select-text">
                <span className="text-faint">Sen: </span>
                <span className="text-ink">{voice.userCaption}</span>
              </p>
            )}
            {voice.assistantCaption && (
              <p className="select-text">
                <span className="text-accent">Jarvis: </span>
                <span className="text-muted">{voice.assistantCaption}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-4 pt-1">
              {conversationId !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={MessageSquare}
                  onClick={() => onOpenConversation(conversationId)}
                  className="!px-0 !py-0 text-accent hover:bg-transparent hover:text-accent-hover"
                >
                  Sohbette aç
                </Button>
              )}
              {voice.sessionActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Square}
                  onClick={toggleVoiceSession}
                  className="!px-0 !py-0 hover:bg-transparent"
                >
                  Sesli sohbeti bitir
                </Button>
              )}
            </div>
          </Card>
        )}
        {voiceError && (
          <p className="mt-3 max-w-2xl text-center text-xs text-negative select-text">
            {voiceError}
          </p>
        )}

        <div className="mt-8 flex w-full justify-center">
          <CommandBox onSubmit={onAsk} />
        </div>

        <div className="mt-12 grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="animate-enter" style={{ animationDelay: '0ms' }}>
            <QuickAccess onNavigate={onNavigate} />
          </div>
          <div className="animate-enter" style={{ animationDelay: '60ms' }}>
            <HomeCard title="Son işlemler" icon={History}>
              <ActivityList limit={5} compact />
            </HomeCard>
          </div>
          <div className="animate-enter" style={{ animationDelay: '120ms' }}>
            <SystemStatusCard />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
