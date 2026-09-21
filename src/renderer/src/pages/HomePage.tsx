import { MessageSquare, Square } from 'lucide-react'
import type { Reminder, Task } from '@shared/api'
import ActivityList from '../components/activity/ActivityList'
import CommandBox from '../components/home/CommandBox'
import SystemStatusStrip from '../components/home/SystemStatusStrip'
import Orb from '../components/jarvis/Orb'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import { STATE_LABELS, useAssistantState } from '../lib/assistantState'
import { useClock } from '../lib/deviceStatus'
import { buildHomeSummary } from '../lib/homeSummary'
import type { PageId } from '../lib/pages'
import { useLiveData } from '../lib/useLiveData'
import { toggleVoiceSession, useVoice, type VoiceSnapshot } from '../lib/voiceClient'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()

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

// Jarvis ana ekranı: ortada küre, kişiye özel tek cümle, komut kutusu ve ince durum şeridi
function HomePage({ onNavigate, onAsk, onOpenConversation }: HomePageProps): React.JSX.Element {
  const state = useAssistantState()
  const voice = useVoice()
  const now = useClock(60_000)
  const tasks = useLiveData(loadTasks, 'tasks').data
  const reminders = useLiveData(loadReminders, 'reminders').data
  const voiceError = voice.micError ?? voice.error
  const conversationId = voice.conversationId
  const summary = tasks && reminders ? buildHomeSummary({ tasks, reminders, now }) : null
  // Boştayken ipucu, aksi halde sesli sohbetin ya da asistanın o anki durumu
  const caption = state === 'idle' ? voiceHint(voice) : `${STATE_LABELS[state]}...`

  return (
    <div className="relative h-full overflow-y-auto">
      {/* Küre arkasında çok hafif ışıma; sayfa zemini düz kalır */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(ellipse 45% 55% at 50% 32%, color-mix(in oklab, var(--color-accent) 9%, transparent), transparent 70%)'
        }}
      />
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-8 py-8">
        <button
          onClick={toggleVoiceSession}
          aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
          title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
          className="max-w-full cursor-pointer rounded-full focus-visible:outline-offset-[-24px]"
        >
          <Orb state={state} size={300} />
        </button>

        <h1 className="-mt-6 text-[40px] leading-tight font-medium tracking-tight text-ink">
          {greeting(now.getHours())}
        </h1>
        <div className="mt-2 flex h-6 items-center">
          {summary ? (
            <p className="animate-fade text-base text-muted">{summary}</p>
          ) : (
            <Skeleton className="h-4 w-72" />
          )}
        </div>
        <p className="mt-1 h-5 text-xs text-faint">{caption}</p>

        {(voice.userCaption || voice.assistantCaption) && (
          <Card padding="sm" className="animate-fade mt-4 w-full max-w-2xl space-y-2 px-4 text-sm">
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

        <div className="mt-6 flex w-full justify-center">
          <CommandBox onSubmit={onAsk} />
        </div>

        <div className="mt-10 flex w-full flex-col items-center gap-3">
          <SystemStatusStrip />
          <button
            onClick={() => onNavigate('settings')}
            className="w-full max-w-sm rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface"
            title="Tüm işlemler Ayarlar'da"
          >
            <ActivityList limit={1} compact />
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomePage
