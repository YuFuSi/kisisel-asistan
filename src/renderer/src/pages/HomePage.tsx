import { useRef, useState } from 'react'
import { MessageSquare, Square } from 'lucide-react'
import type { Reminder, Task } from '@shared/api'
import ActivityList from '../components/activity/ActivityList'
import AuroraBackground from '../components/home/AuroraBackground'
import CommandBox from '../components/home/CommandBox'
import FloatingTile from '../components/home/FloatingTile'
import SystemStatusStrip from '../components/home/SystemStatusStrip'
import Orb from '../components/jarvis/Orb'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import { STATE_LABELS, useAssistantState } from '../lib/assistantState'
import { useBattery, useClock, useOnline } from '../lib/deviceStatus'
import { buildHomeSummary, summarizeToday } from '../lib/homeSummary'
import type { PageId } from '../lib/pages'
import { useLiveData } from '../lib/useLiveData'
import { toggleVoiceSession, useVoice, type VoiceSnapshot } from '../lib/voiceClient'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()

// Yazı yazılırken küre bu kadar süre heyecanlı kalır
const EXCITE_MS = 700
// Fare paralaksı: küre ve parçalar zıt yönde en fazla bu kadar piksel kayar
const PARALLAX_ORB = 10
const PARALLAX_TILES = 16

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

// Jarvis ana ekranı: canlı arka plan, sahnedeki küre, çevresinde süzülen bilgi parçaları,
// kişiye özel tek cümle, komut kutusu ve ince durum şeridi
function HomePage({ onNavigate, onAsk, onOpenConversation }: HomePageProps): React.JSX.Element {
  const state = useAssistantState()
  const voice = useVoice()
  const now = useClock(60_000)
  const online = useOnline()
  const battery = useBattery()
  const tasks = useLiveData(loadTasks, 'tasks').data
  const reminders = useLiveData(loadReminders, 'reminders').data
  const [excite, setExcite] = useState(0)
  const exciteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const orbLayer = useRef<HTMLDivElement>(null)
  const tileLayer = useRef<HTMLDivElement>(null)

  const voiceError = voice.micError ?? voice.error
  const conversationId = voice.conversationId
  const today = tasks && reminders ? summarizeToday({ tasks, reminders, now }) : null
  const summary = tasks && reminders ? buildHomeSummary({ tasks, reminders, now }) : null
  // Boştayken ipucu, aksi halde sesli sohbetin ya da asistanın o anki durumu
  const caption = state === 'idle' ? voiceHint(voice) : `${STATE_LABELS[state]}...`

  function noteTyping(): void {
    setExcite(1)
    clearTimeout(exciteTimer.current)
    exciteTimer.current = setTimeout(() => setExcite(0), EXCITE_MS)
  }

  // Fare hareketiyle küre ve parçalar zıt yönlerde çok hafif kayar (derinlik hissi)
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1
    if (orbLayer.current) {
      orbLayer.current.style.transform = `translate(${nx * PARALLAX_ORB}px, ${ny * PARALLAX_ORB}px)`
    }
    if (tileLayer.current) {
      tileLayer.current.style.transform = `translate(${-nx * PARALLAX_TILES}px, ${-ny * PARALLAX_TILES}px)`
    }
  }

  const clock = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

  return (
    <div className="relative h-full">
      <AuroraBackground state={state} />
      <div className="relative h-full overflow-y-auto" onPointerMove={handlePointerMove}>
        <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center px-8 py-6">
          <div className="@container relative h-[360px] w-full">
            <div
              ref={tileLayer}
              className="absolute inset-0 transition-transform duration-500 ease-out"
            >
              <FloatingTile
                label="Şimdi"
                value={clock}
                detail={date}
                className="top-[10%] left-0"
                delayMs={200}
              />
              <FloatingTile
                label="Sıradaki"
                value={today?.next ? today.next.time : 'Boş'}
                detail={today?.next ? today.next.label : 'Saatli iş yok'}
                className="top-[10%] right-0"
                delayMs={320}
              />
              <FloatingTile
                label="Görevler"
                value={today ? `${today.dueTasks} bugün` : '...'}
                detail={today && today.overdue > 0 ? `${today.overdue} gecikti` : 'Yolunda'}
                onClick={() => onNavigate('tasks')}
                className="bottom-[14%] left-8"
                delayMs={440}
              />
              <FloatingTile
                label="Sistem"
                value={
                  battery ? `%${Math.round(battery.level * 100)}` : online ? 'Hazır' : 'Çevrimdışı'
                }
                detail={
                  battery
                    ? `${battery.charging ? 'Şarj oluyor' : 'Pil'} · ${online ? 'Çevrimiçi' : 'Çevrimdışı'}`
                    : online
                      ? 'Çevrimiçi'
                      : 'İnternet yok'
                }
                className="right-8 bottom-[14%]"
                delayMs={560}
              />
            </div>
            <div
              ref={orbLayer}
              className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
            >
              <button
                onClick={toggleVoiceSession}
                aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                className="animate-orb-in max-w-full cursor-pointer rounded-full focus-visible:outline-offset-[-24px]"
              >
                <Orb state={state} size={360} excite={excite} />
              </button>
            </div>
          </div>

          <h1 className="-mt-8 text-[40px] leading-tight font-medium tracking-tight text-ink">
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
            <Card
              padding="sm"
              className="animate-fade mt-4 w-full max-w-2xl space-y-2 px-4 text-sm"
            >
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

          <div className="mt-5 flex w-full justify-center">
            <CommandBox onSubmit={onAsk} onTyping={noteTyping} />
          </div>

          <div className="mt-8 flex w-full flex-col items-center gap-2">
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
    </div>
  )
}

export default HomePage
