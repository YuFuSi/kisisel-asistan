import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { Check, MessageSquare, X } from 'lucide-react'
import type { Activity } from '@shared/activity'
import type { SettingsView } from '@shared/api'
import Pet from './components/jarvis/Pet'
import ResultCard from './components/jarvis/ResultCard'
import SpeechBubble from './components/jarvis/SpeechBubble'
import {
  respondToApproval,
  useAssistantEmotion,
  useLastOutcome,
  usePendingApprovals,
  useResultCards,
  useWorkSteps,
  type Outcome
} from './lib/assistantState'
import { pickLine, type LineKey } from './lib/companionLines'
import { useOrbPrefs } from './lib/orbPrefs'
import type { PetMood } from './lib/petLook'
import { useRemoteAssistant } from './lib/remoteAssistant'
import { useLiveData } from './lib/useLiveData'
import { useReducedMotion } from './lib/useReducedMotion'
import { speakBabble } from './lib/babble'
import { useSfxEnabled } from './lib/soundEffects'
import { currentStep } from './lib/workSteps'

// Masaüstü arkadaş (#companion): görev çubuğunun üstündeki saydam şeritte yaşayan Jarvis robotu.
// Çentiğin işlerini yapar (onay, iş bitti, çalışan adım, belge bırakma) ve kullanıcının ne yaptığına
// göre arada konuşma balonuyla yorum yapar. Boştayken dolaşır, video izlenirken köşeye gelip izler
// ve bir süre sonra uyuyakalır. Tıklanınca Jarvis açılır.

const SIZE = 104
// Robotun kutusu: eller, anten ve efektler için pay
const BOX = SIZE * 1.8
const SPEED = 90 // px/sn
const OUTCOME_MS = 7000
const BUBBLE_W = 300
const LINE_MS = 5500
// Video bu kadar sürerse robot uyuyakalır
const VIDEO_SLEEP_MS = 10 * 60_000
// Kod bu kadar sürerse mola önerir
const LONG_CODE_MS = 90 * 60_000

// Konuşkanlık: yorumlar arasında en az bu kadar süre. Kullanıcının yaptığı işe tepki ("video
// açtın") daha sık olabilir; boştayken kendi kendine konuşma daha seyrek.
type Chattiness = SettingsView['companionChattiness']
const REACT_GAP_MS: Record<Chattiness, number> = {
  quiet: Infinity,
  sometimes: 3 * 60_000,
  chatty: 60_000
}
const IDLE_GAP_MS: Record<Chattiness, number> = {
  quiet: Infinity,
  sometimes: 15 * 60_000,
  chatty: 4 * 60_000
}

const loadSettings = (): Promise<SettingsView> => window.api.settings.get()

function inQuietHours(settings: SettingsView | null): boolean {
  if (!settings?.quietStart || !settings.quietEnd) return false
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (value: string): number => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }
  const start = toMinutes(settings.quietStart)
  const end = toMinutes(settings.quietEnd)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

// Düz sohbet cevapları gösterilmez; sadece araçla yapılan işler ve sorunlar
function worthShowing(outcome: Outcome | null): boolean {
  if (!outcome) return false
  return outcome.kind !== 'completed' || outcome.toolCount > 0
}

const OUTCOME_TEXT: Record<Outcome['kind'], string> = {
  completed: 'Tamamlandı!',
  partial: 'Bir adım hata verdi, kısmen yaptım.',
  rejected: 'Tamam, yapmadım.',
  timeout: 'Onay gelmedi, işlemi yapmadım.',
  stopped: 'Durdurdum.',
  error: 'Bir hata oldu...'
}

function CompanionApp(): React.JSX.Element {
  const { state } = useRemoteAssistant()
  const emotion = useAssistantEmotion()
  const steps = useWorkSteps()
  const approvals = usePendingApprovals()
  const outcome = useLastOutcome()
  const cards = useResultCards()
  const { character } = useOrbPrefs()
  const variant = character === 'cube' ? 'cube' : 'robot'
  const reduced = useReducedMotion()
  const sfx = useSfxEnabled()
  const { data: settings } = useLiveData(loadSettings, 'settings')

  const x = useMotionValue(Math.max(0, window.innerWidth - BOX - 60))
  const [walking, setWalking] = useState<0 | 1 | -1>(0)
  const [mood, setMood] = useState<PetMood>('idle')
  const [activity, setActivity] = useState<Activity | null>(null)
  const [line, setLine] = useState<{ text: string; key: number } | null>(null)
  const [shownOutcome, setShownOutcome] = useState<Outcome | null>(null)
  const [dragging, setDragging] = useState(false)
  const [videoSleepy, setVideoSleepy] = useState(false)
  // Pencere gizliyken (tam ekran oyun, Jarvis önde) dolaşma, yorum ve ses durur
  const [shown, setShown] = useState(true)
  const lastLineAt = useRef(0)
  const pointerX = useRef<number | null>(null)
  const hovering = useRef(false)
  const pressed = useRef(false)

  const approval = approvals[0]
  const running = currentStep(steps)
  const busy = state !== 'idle'

  // --- Aktivite: ana süreç öndeki pencereye bakıp bildirir
  useEffect(() => {
    window.api.companion.currentActivity().then(setActivity, () => {})
    const offActivity = window.api.companion.onActivity(setActivity)
    const offVisible = window.api.companion.onVisible(setShown)
    return () => {
      offActivity()
      offVisible()
    }
  }, [])
  const meeting = activity?.kind === 'meeting'
  const quietHours = inQuietHours(settings ?? null)

  // --- Konuşma balonu: kendiliğinden yorumlar konuşkanlık ayarına ve rahatsız edilmemesi gereken
  // durumlara (toplantı, tam ekran oyun, gizli pencere) uyar. "Sessiz" ayarında hiç konuşmaz.
  // skipGap sadece aralık sınırını atlar (ilk selam, toplantı öncesi hatırlatma); sessizlik
  // tercihini atlamaz. Sessiz saatlerde balon gösterilir ama ses çıkmaz.
  const say = (key: LineKey, skipGap = false, test = false): void => {
    const now = Date.now()
    const chattiness = settings?.companionChattiness ?? 'sometimes'
    const gap = key === 'idle' ? IDLE_GAP_MS[chattiness] : REACT_GAP_MS[chattiness]
    if (!test) {
      if (chattiness === 'quiet' || !shown) return
      if (!skipGap && now - lastLineAt.current < gap) return
      if (activity?.fullscreen && activity.kind === 'game') return
      if (activity?.kind === 'meeting' && key !== 'meeting') return
    }
    const text = pickLine(key)
    if (!text) return
    lastLineAt.current = now
    setLine({ text, key: now })
  }
  const sayRef = useRef(say)
  useEffect(() => {
    sayRef.current = say
  })

  // Sadece geliştirmede: CDP testlerinin robota replik söyletebilmesi için
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debug = window as unknown as { __companionSay?: (key: LineKey) => void }
    debug.__companionSay = (key) => sayRef.current(key, true, true)
    return () => {
      delete debug.__companionSay
    }
  }, [])

  useEffect(() => {
    if (!line) return
    const hide = setTimeout(() => setLine(null), LINE_MS)
    return () => clearTimeout(hide)
  }, [line])

  // Aktivite değişince bir kez yorum (ilk açılışta sabah/gece selamı)
  const activityKind = activity?.kind
  useEffect(() => {
    if (!activityKind) return
    const hour = new Date().getHours()
    const first = lastLineAt.current === 0
    const timer = setTimeout(() => {
      if (first && hour < 5) sayRef.current('lateNight', true)
      else if (first && hour >= 6 && hour < 11) sayRef.current('morning', true)
      // Toplantı başlarken bir kez hatırlatır, sonra susar
      else sayRef.current(activityKind, activityKind === 'meeting')
    }, 1200)
    return () => clearTimeout(timer)
  }, [activityKind])

  // Uzun video: uyuyakalır; uzun kod: mola önerir
  useEffect(() => {
    if (activityKind !== 'video' && activityKind !== 'code') return
    const timer = setTimeout(
      () => {
        if (activityKind === 'video') {
          setVideoSleepy(true)
          sayRef.current('videoSleepy')
        } else sayRef.current('longCode')
      },
      activityKind === 'video' ? VIDEO_SLEEP_MS : LONG_CODE_MS
    )
    return () => {
      clearTimeout(timer)
      setTimeout(() => setVideoSleepy(false), 0)
    }
  }, [activityKind])

  // --- İş sonucu balonu
  useEffect(() => {
    if (!worthShowing(outcome)) return
    const show = setTimeout(() => setShownOutcome(outcome), 0)
    const hide = setTimeout(() => setShownOutcome(null), OUTCOME_MS)
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [outcome])

  // --- Dolaşma: video izlenirken sağ köşeye gidip oturur; boştayken rastgele dolaşır,
  // bazen fareyi kovalar. Çalışırken, uyurken, onay beklerken durur.
  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      pointerX.current = event.clientX
    }
    const onLeave = (): void => {
      pointerX.current = null
    }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const walkTo = (target: number): ReturnType<typeof animate> | undefined => {
    const max = window.innerWidth - BOX
    const goal = Math.min(max, Math.max(0, target))
    const distance = Math.abs(goal - x.get())
    if (distance < 30) return undefined
    setWalking(goal > x.get() ? 1 : -1)
    const walk = animate(x, goal, { duration: reduced ? 0 : distance / SPEED, ease: 'linear' })
    walk.then(() => setWalking(0))
    return walk
  }
  const walkToRef = useRef(walkTo)
  useEffect(() => {
    walkToRef.current = walkTo
  })

  // Video: izlemek için sağ köşeye gelir
  useEffect(() => {
    if (activityKind !== 'video') return
    const walk = walkToRef.current(window.innerWidth - BOX - 40)
    return () => walk?.stop()
  }, [activityKind])

  const free =
    shown && !busy && !approval && mood === 'idle' && activityKind !== 'video' && !dragging

  // Boştayken arada kendi kendine konuşur (konuşkanlık sınırına uyar)
  useEffect(() => {
    if (!free) return
    const timer = setInterval(() => sayRef.current('idle'), 5 * 60_000)
    return () => clearInterval(timer)
  }, [free])
  useEffect(() => {
    if (!free || reduced) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let walk: ReturnType<typeof animate> | undefined
    const next = (): void => {
      timer = setTimeout(
        () => {
          if (stopped) return
          const roll = Math.random()
          const max = window.innerWidth - BOX
          let target: number | null = null
          if (pointerX.current !== null && roll < 0.3) target = pointerX.current - BOX / 2
          else if (roll < 0.7) target = Math.random() * max
          if (target === null || hovering.current) return next()
          walk = walkToRef.current(target)
          if (!walk) return next()
          walk.then(() => {
            if (!stopped) next()
          })
        },
        4000 + Math.random() * 8000
      )
    }
    next()
    return () => {
      stopped = true
      clearTimeout(timer)
      walk?.stop()
      setTimeout(() => setWalking(0), 0)
    }
  }, [free, reduced])

  // --- Tıklama geçirgenliği: fare robotun/balonun üstündeyken pencere tıklamaları alır
  const setInteractive = (value: boolean): void => window.api.companion.setInteractive(value)
  useEffect(() => {
    const onUp = (): void => {
      pressed.current = false
      if (!hovering.current) setInteractive(false)
    }
    // Basma iptal olursa ya da pencere odağı kaybolursa geçirgenlik takılı kalmasın
    const onCancel = (): void => {
      pressed.current = false
      hovering.current = false
      setInteractive(false)
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onCancel)
    }
  }, [])
  useEffect(() => {
    if (shown) return
    pressed.current = false
    hovering.current = false
    setTimeout(() => setDragging(false), 0)
  }, [shown])

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.api.documents.pathForFile(file))
      .filter(Boolean)
    if (paths.length > 0) window.api.notch.dropFiles(paths)
  }

  // Balonda ne söylenecek (öncelik sırasıyla)
  const talk: {
    text: string
    tone: 'normal' | 'approval' | 'success' | 'error'
    actions?: React.ReactNode
  } | null = dragging
    ? { text: 'Bırak, yeni sohbete ekleyeyim!', tone: 'normal' }
    : approval
      ? {
          // Toplantıda ekran paylaşılıyor olabilir: işlemin ayrıntısı balonda yazılmaz
          text: meeting
            ? `${pickLine('approval', approval.approval.id)} Ayrıntısı Jarvis penceresinde.`
            : `${pickLine('approval', approval.approval.id)} ${approval.approval.label}: ${approval.approval.summary}${approvals.length > 1 ? ` (${approvals.length} işlem)` : ''}`,
          tone: 'approval',
          actions: (
            <>
              <button
                onClick={() => respondToApproval(approval.approval.id, true)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-app hover:bg-accent-hover"
              >
                <Check className="h-4 w-4" />
                Onayla
              </button>
              <button
                onClick={() => respondToApproval(approval.approval.id, false)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-ink hover:bg-elevated"
              >
                <X className="h-4 w-4" />
                Reddet
              </button>
            </>
          )
        }
      : shownOutcome
        ? {
            text:
              shownOutcome.kind === 'completed'
                ? (pickLine('done', shownOutcome.seq) ?? OUTCOME_TEXT.completed)
                : shownOutcome.kind === 'error' || shownOutcome.kind === 'partial'
                  ? `${pickLine('error', shownOutcome.seq) ?? ''} ${OUTCOME_TEXT[shownOutcome.kind]}`
                  : OUTCOME_TEXT[shownOutcome.kind],
            tone:
              shownOutcome.kind === 'completed'
                ? 'success'
                : shownOutcome.kind === 'error' || shownOutcome.kind === 'partial'
                  ? 'error'
                  : 'normal',
            actions: (
              <div className="w-full space-y-2">
                {cards.length > 0 && !meeting && <ResultCard card={cards[cards.length - 1]} />}
                <button
                  onClick={() => void window.api.notch.navigate('chat')}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Sohbette aç
                </button>
              </div>
            )
          }
        : running && state === 'working'
          ? { text: `${running.label} çalışıyor...`, tone: 'normal' }
          : line
            ? { text: line.text, tone: 'normal' }
            : null

  // Robot konuşurken "bip-bop" robot dilinde mırıldanır (ses efektleri açıksa)
  const talkText = talk?.text
  const speechVolume = settings?.speechVolume ?? 1
  useEffect(() => {
    if (!talkText || !sfx || !shown || quietHours) return
    const babble = speakBabble(talkText, { volume: speechVolume * 0.6 })
    return () => babble.stop()
  }, [talkText, sfx, speechVolume, shown, quietHours])

  // Balon robotun üstünde; ekran kenarına yakınken içeride kalsın diye kaydırılır (yürürken de)
  const bubbleLeft = useTransform(x, (value) =>
    Math.min(Math.max(-value, BOX / 2 - BUBBLE_W / 2), window.innerWidth - BUBBLE_W - value)
  )
  const bubbleSide = useTransform(x, (value) => (value > window.innerWidth / 2 ? 'right' : 'left'))
  const [side, setSide] = useState<'left' | 'right'>(bubbleSide.get())
  useEffect(() => bubbleSide.on('change', setSide), [bubbleSide])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="pointer-events-auto absolute bottom-0"
        style={{ x, width: BOX }}
        onPointerEnter={() => {
          hovering.current = true
          setInteractive(true)
        }}
        onPointerLeave={() => {
          hovering.current = false
          if (!pressed.current) setInteractive(false)
        }}
        onPointerDown={() => {
          pressed.current = true
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {talk && (
          <motion.div
            className="absolute overflow-y-auto pb-3 [scrollbar-width:thin]"
            style={{
              // Robotun başının hemen üstü (anten dahil); uzun onaylar kesilmesin diye pencere
              // yüksekliğini aşmaz, gerekirse kaydırılır
              bottom: SIZE * 1.3 - 12,
              maxHeight: window.innerHeight - SIZE * 1.3 - 8,
              width: BUBBLE_W,
              left: bubbleLeft
            }}
          >
            <SpeechBubble
              text={talk.text}
              tone={talk.tone}
              actions={talk.actions}
              solid
              side={side}
            />
          </motion.div>
        )}

        <div className="flex h-[200px] items-end justify-center">
          {/* Yürürken adım adım sallanır ve gittiği yöne eğilir */}
          <motion.div
            animate={
              walking && !reduced
                ? {
                    y: [0, -7, 0],
                    rotate: [walking * 4, walking * 8, walking * 4],
                    transition: { duration: 0.36, repeat: Infinity }
                  }
                : { y: 0, rotate: 0 }
            }
          >
            <Pet
              variant={variant}
              state={state}
              emotion={emotion}
              size={SIZE}
              activity={running?.name ?? null}
              forceMood={
                videoSleepy && !busy ? 'sleep' : activityKind === 'video' && !busy ? 'listen' : null
              }
              hungry={dragging}
              paused={!shown}
              onMoodChange={setMood}
              onClick={() => void window.api.notch.navigate('home')}
              label="Jarvis’i aç"
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default CompanionApp
