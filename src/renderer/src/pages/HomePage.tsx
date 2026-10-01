import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CloudSun, ListTodo, MessageSquare, Square } from 'lucide-react'
import { motion } from 'motion/react'
import type { CalendarItem, HomeWeather, Memory, Reminder, Task } from '@shared/api'
import CommandBox from '../components/home/CommandBox'
import Orb from '../components/jarvis/Orb'
import OrbHalo from '../components/jarvis/OrbHalo'
import Pet from '../components/jarvis/Pet'
import { useOrbPrefs } from '../lib/orbPrefs'
import OrbitTools from '../components/jarvis/OrbitTools'
import TaskOrbit from '../components/jarvis/TaskOrbit'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import IconTile from '../components/ui/IconTile'
import {
  STATE_LABELS,
  celebrate,
  useAssistantEmotion,
  useAssistantState,
  noteNotification,
  useNoticeSeq,
  useWorkSteps
} from '../lib/assistantState'
import { requestAttachFiles } from '../lib/chatRequests'
import { useClock } from '../lib/deviceStatus'
import { greeting } from '../lib/greeting'
import { toIsoDate } from '../lib/dates'
import { buildHomeSummary, summarizeToday } from '../lib/homeSummary'
import type { PageId } from '../lib/pages'
import { useLiveData } from '../lib/useLiveData'
import { currentStep } from '../lib/workSteps'
import { toggleVoiceSession, useVoice, type VoiceSnapshot } from '../lib/voiceClient'
import { useHandTracking } from '../lib/useHandTracking'
import { hasCamera, useClapActivation } from '../lib/useClapActivation'
import { useToast } from '../lib/toast'
import { useWindowDrag } from '../lib/useWindowDrag'
import { findUserName } from '../lib/userName'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()
const loadMemories = (): Promise<Memory[]> => window.api.memories.list()

/** "14:30" gibi bugünkü saate kalan süre: "25 dk sonra", "2 sa 10 dk sonra" */
function countdown(time: string, now: Date): string {
  const [h, m] = time.split(':').map(Number)
  const minutes = h * 60 + m - (now.getHours() * 60 + now.getMinutes())
  if (minutes <= 0) return 'şimdi'
  if (minutes < 60) return `${minutes} dk sonra`
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} sa${rest ? ` ${rest} dk` : ''} sonra`
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Yazı yazılırken küre bu kadar süre heyecanlı kalır
const EXCITE_MS = 700
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

// Ana Sayfa öğeleri sırayla, yumuşak bir yaylanmayla belirir (Jarvis Cam)
const rise = (delay: number): Record<string, unknown> => ({
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { type: 'spring', stiffness: 120, damping: 20, delay }
})

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
        return 'Dinliyorum... Bitirmek için “dur” de veya Jarvis’e dokun.'
      case 'transcribing':
        return 'Söylediğini yazıya çeviriyorum...'
      case 'responding':
        return 'Cevaplıyorum...'
    }
  }
  return voice.phase === 'wake'
    ? '“Hey Jarvis” de veya konuşmak için Jarvis’e dokun'
    : 'Konuşmak için Jarvis’e dokun'
}

// Ana deneyim küre ve komut; günlük bağlam kullanıcı açtığında görünür.
function HomePage({
  onNavigate,
  onAsk,
  onOpenConversation,
  handControlOn,
  onHandControlChange
}: HomePageProps): React.JSX.Element {
  const { character } = useOrbPrefs()
  const state = useAssistantState()
  const emotion = useAssistantEmotion()
  const steps = useWorkSteps()
  const notice = useNoticeSeq()
  const voice = useVoice()
  const now = useClock(60_000)
  const tasks = useLiveData(loadTasks, 'tasks').data
  const reminders = useLiveData(loadReminders, 'reminders').data
  const memories = useLiveData(loadMemories, 'memories').data
  // Kişisel notun yenilenmesi için hafızadaki değişikliğin imzası (içerik değişince değişir)
  const memorySignature = memories?.map((m) => `${m.id}:${m.kind}:${m.content}`).join('|')
  const userName = memories
    ? findUserName(memories.filter((m) => m.kind === 'profil').map((m) => m.content))
    : null
  // Hava ve bugünün takvimi saatte bir yenilenir (ana süreç havayı zaten önbellekte tutar)
  const [todayOpen, setTodayOpen] = useState(false)
  const [weather, setWeather] = useState<HomeWeather | null>(null)
  const [events, setEvents] = useState<CalendarItem[]>([])
  // Hafıza + bugünün işleri + takvimden yerel modelle yazılan not; gelene kadar (veya model
  // kullanılamazsa) düz özet gösterilir. Ana süreç aynı bağlam için önbellekten döner.
  const [personalNote, setPersonalNote] = useState<string | null>(null)
  const noteHour = now.getHours()
  useEffect(() => {
    if (!todayOpen) return
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
  }, [tasks, reminders, memorySignature, noteHour, todayOpen])
  useEffect(() => {
    if (!todayOpen) return
    let active = true
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    window.api.system.weather().then(
      (value) => active && setWeather(value),
      () => {}
    )
    window.api.calendar.events(dayStart.toISOString(), dayEnd.toISOString()).then(
      (list) => active && setEvents(list),
      () => {}
    )
    return () => {
      active = false
    }
  }, [noteHour, todayOpen])
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
  // İki hızlı alkış: eller kamerayı yönetmeden önce serbest olmalı, bu yüzden düğme yerine ses.
  // Jarvis konuşurken/dinlerken alkış sayılmaz: hoparlörden çıkan kendi sesi mikrofona dönüp
  // "iki alkış" gibi algılanabiliyor ve el kontrolü kendiliğinden açılıyordu. Kamera yoksa açılmaz.
  const toast = useToast()
  const voiceBusy = state === 'speaking' || state === 'listening'
  useClapActivation(true, () => {
    if (voiceBusy) return
    if (handControlOn) {
      onHandControlChange(false)
      return
    }
    void hasCamera().then((available) => {
      if (available) onHandControlChange(true)
      else toast.show('El kontrolü için kamera bulunamadı.', 'info')
    })
  })
  // Kamera açılırken hata verirse el kontrolü birkaç saniye sonra kendiliğinden kapanır
  useEffect(() => {
    if (!handControlOn || handStatus !== 'error') return
    const timer = setTimeout(() => onHandControlChange(false), 4000)
    return () => clearTimeout(timer)
  }, [handControlOn, handStatus, onHandControlChange])
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
    void window.api.tasks.update(id, { done: true }).then(celebrate, () => {})
  }
  const exciteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(exciteTimer.current), [])

  const voiceError = voice.micError ?? voice.error
  const conversationId = voice.conversationId
  const today = tasks && reminders ? summarizeToday({ tasks, reminders, now }) : null
  const summary = tasks && reminders ? buildHomeSummary({ tasks, reminders, now }) : null
  // Sıradaki: görev/hatırlatma ile takvimdeki saatli etkinliklerin en yakını
  const nextEvent = events
    .filter((event) => !event.allDay && event.start > now.getTime())
    .sort((a, b) => a.start - b.start)[0]
  const next =
    nextEvent && (!today?.next || hhmm(nextEvent.start) < today.next.time)
      ? { time: hhmm(nextEvent.start), label: nextEvent.title }
      : (today?.next ?? null)
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
      <div className="relative h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-6 sm:px-8">
          <div
            className={`relative w-full shrink-0 ${handControlOn ? 'h-[440px]' : 'h-[280px] sm:h-[340px]'}`}
          >
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 18 }}
            >
              {!handControlOn && <OrbHalo state={state} size={330} />}
              {!handControlOn && character !== 'orb' ? (
                <Pet
                  variant={character}
                  state={state}
                  emotion={emotion}
                  size={170}
                  attention={excite}
                  activity={running?.name ?? null}
                  onClick={toggleVoiceSession}
                  label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                />
              ) : (
                <button
                  onClick={toggleVoiceSession}
                  aria-label={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                  title={voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
                  className="max-w-full cursor-pointer rounded-full transition-transform duration-[var(--motion-control)] focus-visible:outline-offset-[-24px]"
                  style={{ transform: `scale(${orbScale})` }}
                >
                  <Orb
                    state={state}
                    size={handControlOn ? 440 : 300}
                    excite={dragging ? 1 : excite}
                    emotion={emotion}
                    steps={steps}
                    notice={notice}
                    glass
                  />
                </button>
              )}
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
            </motion.div>
          </div>

          <video ref={handVideoRef} className="hidden" muted playsInline />

          <motion.h1
            {...rise(0.15)}
            className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-center text-4xl leading-tight font-semibold tracking-[-0.025em] text-transparent sm:text-[46px]"
          >
            {greeting(now.getHours())}
            {userName ? `, ${userName}` : ''}
          </motion.h1>
          <motion.div
            {...rise(0.22)}
            className="mt-2 flex min-h-6 max-w-2xl items-center justify-center text-center"
          >
            <p className="text-base text-muted">
              {next
                ? `Bir sonraki işin ${countdown(next.time, now)}: ${next.label}`
                : (summary ?? 'Buradayım. Ne yapalım?')}
            </p>
          </motion.div>
          <p role="status" className="mt-2 min-h-5 max-w-xl text-center text-xs text-muted">
            {caption}
          </p>

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

          <motion.div {...rise(0.3)} className="mt-6 flex w-full justify-center">
            <CommandBox onSubmit={onAsk} onTyping={noteTyping} />
          </motion.div>
          {!handControlOn && (
            <motion.details
              {...rise(0.5)}
              onToggle={(event) => setTodayOpen(event.currentTarget.open)}
              className="glass-soft mt-7 w-full max-w-2xl !rounded-[22px] text-left"
            >
              <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[22px] px-4 py-2.5 text-sm text-muted hover:text-ink">
                <IconTile icon={CalendarDays} tone="blue" size={26} />
                Gününü gör
              </summary>
              <div className="space-y-3 border-t border-white/5 px-5 py-4 text-sm">
                <p className="text-muted">
                  {personalNote ?? summary ?? 'Günün bilgileri hazırlanıyor.'}
                </p>
                {next && (
                  <p className="text-ink">
                    Sıradaki: {next.label} · {countdown(next.time, now)}
                  </p>
                )}
                <ul className="space-y-1 text-muted">
                  {(tasks ?? [])
                    .filter(
                      (task) =>
                        task.doneAt === null &&
                        task.dueDate !== null &&
                        task.dueDate <= toIsoDate(now)
                    )
                    .slice(0, 5)
                    .map((task) => (
                      <li key={task.id} className="break-words">
                        {task.title}
                      </li>
                    ))}
                </ul>
                {weather && (
                  <p className="flex items-center gap-2 text-muted">
                    <IconTile icon={CloudSun} tone="amber" size={22} />
                    {weather.temperature}° · {weather.condition}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ListTodo}
                    onClick={() => onNavigate('tasks')}
                  >
                    Görevler{today ? ` · ${today.dueTasks}` : ''}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('calendar')}>
                    Takvim · {events.length} etkinlik
                  </Button>
                </div>
              </div>
            </motion.details>
          )}
        </div>
      </div>
    </div>
  )
}

export default HomePage
