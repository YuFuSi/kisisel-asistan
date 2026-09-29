import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Square } from 'lucide-react'
import type { Reminder, Task } from '@shared/api'
import AuroraBackground from '../components/home/AuroraBackground'
import CommandBox from '../components/home/CommandBox'
import FloatingTile from '../components/home/FloatingTile'
import Orb from '../components/jarvis/Orb'
import OrbitTools from '../components/jarvis/OrbitTools'
import TaskOrbit from '../components/jarvis/TaskOrbit'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import {
  STATE_LABELS,
  useAssistantEmotion,
  useAssistantState,
  noteNotification,
  useNoticeSeq,
  useWorkSteps
} from '../lib/assistantState'
import { requestAttachFiles } from '../lib/chatRequests'
import { useBattery, useClock, useOnline } from '../lib/deviceStatus'
import { greeting } from '../lib/greeting'
import { buildHomeSummary, summarizeToday } from '../lib/homeSummary'
import type { PageId } from '../lib/pages'
import { useLiveData } from '../lib/useLiveData'
import { currentStep } from '../lib/workSteps'
import { toggleVoiceSession, useVoice, type VoiceSnapshot } from '../lib/voiceClient'
import { useHandTracking } from '../lib/useHandTracking'
import { useClapActivation } from '../lib/useClapActivation'
import { useWindowDrag } from '../lib/useWindowDrag'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()
// Kişisel notun yenilenmesi için hafızadaki değişikliğin imzası (içerik değişince değişir)
const loadMemorySignature = (): Promise<string> =>
  window.api.memories
    .list()
    .then((list) => list.map((m) => `${m.id}:${m.kind}:${m.content}`).join('|'))

// Yazı yazılırken küre bu kadar süre heyecanlı kalır
const EXCITE_MS = 700
// Fare paralaksı: küre ve parçalar zıt yönde en fazla bu kadar piksel kayar
const PARALLAX_ORB = 10
const PARALLAX_TILES = 16
// El ile kontrol açıkken yörünge yarıçapları büyük küreye (440px) göre ayarlandı
const HAND_ORBIT_RADIUS_X = 260
const HAND_ORBIT_RADIUS_Y = 80
const HAND_ORBIT_HOVER_DISTANCE = 65
const HAND_GAIN_X = 640
const HAND_GAIN_Y = 260
// İki elle büyütme/küçültme: küre canvas'ı hep aynı boyutta kalır (yeniden çizim tetiklenmesin
// diye), sadece CSS transform:scale ile görsel olarak büyür/küçülür — hem daha akıcı hem ucuz.
// Eller arası normalize mesafe (0-1) bu aralığa göre ölçeğe eşlenir.
const MIN_HAND_SPREAD = 0.15
const MAX_HAND_SPREAD = 0.75
const MIN_ORB_SCALE = 0.6
const MAX_ORB_SCALE = 1.3

function orbScaleFromSpread(spread: number): number {
  const t = Math.min(
    1,
    Math.max(0, (spread - MIN_HAND_SPREAD) / (MAX_HAND_SPREAD - MIN_HAND_SPREAD))
  )
  return MIN_ORB_SCALE + t * (MAX_ORB_SCALE - MIN_ORB_SCALE)
}

interface HomePageProps {
  onNavigate: (page: PageId) => void
  /** Komut kutusundan gelen istek; yeni sohbette cevaplanır */
  onAsk: (text: string) => void
  /** Sesli sohbetin kaydedildiği sohbeti Asistan sayfasında açar */
  onOpenConversation: (conversationId: number) => void
  /** El ile kontrol açık mı; App.tsx'te tutulur, açıkken sidebar gizlenir */
  handControlOn: boolean
  onHandControlChange: (on: boolean) => void
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
function HomePage({
  onNavigate,
  onAsk,
  onOpenConversation,
  handControlOn,
  onHandControlChange
}: HomePageProps): React.JSX.Element {
  const state = useAssistantState()
  const emotion = useAssistantEmotion()
  const steps = useWorkSteps()
  const notice = useNoticeSeq()
  const voice = useVoice()
  const now = useClock(60_000)
  const online = useOnline()
  const battery = useBattery()
  const tasks = useLiveData(loadTasks, 'tasks').data
  const reminders = useLiveData(loadReminders, 'reminders').data
  const memorySignature = useLiveData(loadMemorySignature, 'memories').data
  // Hafıza + bugünün işleri + takvimden yerel modelle yazılan not; gelene kadar (veya model
  // kullanılamazsa) düz özet gösterilir. Ana süreç aynı bağlam için önbellekten döner.
  const [personalNote, setPersonalNote] = useState<string | null>(null)
  const noteHour = now.getHours()
  useEffect(() => {
    let active = true
    window.api.system.personalNote().then(
      (text) => {
        if (active && text) setPersonalNote(text)
      },
      () => {}
    )
    return () => {
      active = false
    }
  }, [tasks, reminders, memorySignature, noteHour])
  const [excite, setExcite] = useState(0)
  const [dragging, setDragging] = useState(false)
  const {
    videoRef: handVideoRef,
    status: handStatus,
    pinching: handPinching,
    handPoint,
    twoHandSpread,
    handNormalized
  } = useHandTracking(handControlOn, HAND_GAIN_X, HAND_GAIN_Y)
  const orbScale = handControlOn && twoHandSpread !== null ? orbScaleFromSpread(twoHandSpread) : 1
  // İki hızlı alkış: eller kamerayı yönetmeden önce serbest olmalı, bu yüzden düğme yerine ses
  useClapActivation(true, () => onHandControlChange(!handControlOn))
  // Yörüngede bir şeyin üstündeyken pinch normal seçim yapar; boşlukta pinch pencere kavrar
  const [hoveredOrbitItem, setHoveredOrbitItem] = useState<PageId | null>(null)
  // "Görevler"e pinch yapınca sayfaya gitmek yerine gerçek görev kartları gösterilir
  const [taskMode, setTaskMode] = useState(false)
  // El kontrolü kapanınca (alkışla) bir dahaki açılış ana menüden başlasın
  useEffect(() => {
    if (!handControlOn) void Promise.resolve().then(() => setTaskMode(false))
  }, [handControlOn])
  const { dragging: draggingWindow } = useWindowDrag(
    handControlOn && !taskMode && !hoveredOrbitItem,
    handPinching,
    handNormalized
  )

  function handleOrbitSelect(page: PageId): void {
    if (page === 'tasks') {
      setTaskMode(true)
      return
    }
    onNavigate(page)
  }

  function completeTaskByHand(id: number): void {
    void window.api.tasks.update(id, { done: true })
  }
  const exciteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const orbLayer = useRef<HTMLDivElement>(null)
  const tileLayer = useRef<HTMLDivElement>(null)

  const voiceError = voice.micError ?? voice.error
  const conversationId = voice.conversationId
  const today = tasks && reminders ? summarizeToday({ tasks, reminders, now }) : null
  const summary = tasks && reminders ? buildHomeSummary({ tasks, reminders, now }) : null
  // Boştayken ipucu, aksi halde sesli sohbetin ya da asistanın o anki durumu
  const running = currentStep(steps)
  const caption = dragging
    ? 'Belgeyi küreye bırak: PDF, Word veya metin'
    : handControlOn
      ? handStatus === 'loading'
        ? 'El kontrolü açılıyor...'
        : handStatus === 'error'
          ? 'El kontrolü hata verdi (iki alkışla kapat)'
          : draggingWindow
            ? "Pencere sürükleniyor — bırakmak için pinch'i aç"
            : taskMode
              ? 'Bir görevi kavrayıp küreye sürükle: tamamlanır. Boşlukta pinch: geri dön.'
              : 'El ile kontrol açık — bir araca yaklaş, pinch ile seç; boşlukta pinch pencere sürükler; iki elle küreyi büyüt/küçült (kapatmak için iki alkış)'
      : state === 'idle'
        ? voiceHint(voice)
        : running
          ? `${running.label} çalışıyor... · ${steps.length}. adım`
          : `${STATE_LABELS[state]}...`

  // Belge küreye bırakılınca küre "alır" (çift nabız), kısa süre sonra belge yeni sohbete eklenir
  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    noteNotification()
    setTimeout(() => {
      onNavigate('chat')
      requestAttachFiles(files)
    }, 700)
  }

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
    <div
      className="relative h-full"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <AuroraBackground state={state} />
      <div className="relative h-full overflow-y-auto" onPointerMove={handlePointerMove}>
        <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center px-8 py-6">
          <div className="@container relative h-[440px] w-full">
            {!handControlOn && (
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
                    battery
                      ? `%${Math.round(battery.level * 100)}`
                      : online
                        ? 'Hazır'
                        : 'Çevrimdışı'
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
            )}
            <div
              ref={orbLayer}
              className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
            >
              <button
                onClick={toggleVoiceSession}
                aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                className="animate-orb-in max-w-full cursor-pointer rounded-full transition-transform duration-150 ease-out focus-visible:outline-offset-[-24px]"
                style={{ transform: `scale(${orbScale})` }}
              >
                <Orb
                  state={state}
                  size={440}
                  excite={dragging ? 1 : excite}
                  emotion={emotion}
                  steps={steps}
                  notice={notice}
                />
              </button>
              {handControlOn && !draggingWindow && (taskMode || tasks) && (
                <div className="pointer-events-none absolute">
                  {taskMode ? (
                    <TaskOrbit
                      tasks={tasks ?? []}
                      handPoint={handPoint}
                      pinching={handPinching}
                      onComplete={completeTaskByHand}
                      onExit={() => setTaskMode(false)}
                    />
                  ) : (
                    <OrbitTools
                      handPoint={handPoint}
                      pinching={handPinching}
                      onSelect={handleOrbitSelect}
                      onHoverChange={setHoveredOrbitItem}
                      radiusX={HAND_ORBIT_RADIUS_X}
                      radiusY={HAND_ORBIT_RADIUS_Y}
                      hoverDistance={HAND_ORBIT_HOVER_DISTANCE}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <video ref={handVideoRef} className="hidden" muted playsInline />

          <h1 className="-mt-10 text-[40px] leading-tight font-medium tracking-tight text-ink">
            {greeting(now.getHours())}
          </h1>
          <div className="mt-2 flex min-h-6 max-w-2xl items-center justify-center text-center">
            {personalNote ? (
              <p key={personalNote} className="animate-fade text-base text-muted">
                {personalNote}
              </p>
            ) : summary ? (
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
        </div>
      </div>
    </div>
  )
}

export default HomePage
