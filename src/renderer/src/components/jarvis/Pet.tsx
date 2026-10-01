import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type TargetAndTransition
} from 'motion/react'
import type { AssistantState, EmotionSignal } from '../../lib/assistantState'
import { Cookie, Heart, Settings, Star } from 'lucide-react'
import {
  FloatingHearts,
  Hands,
  ScreenIcon,
  SnakeGame,
  SpeakingMouth,
  ThinkingDots
} from './petParts'
import { onPetSignal } from '../../lib/petEvents'
import { bondStage, bumpBond, openBond, useBond } from '../../lib/petBond'
import { ANTENNA_COLOR, toolIcon, type HandGesture, type PetMood } from '../../lib/petLook'

// Jarvis'in pet karakteri (prototip "Jarvis Cam"): cam robot ya da jöle küp. İki görünüm aynı
// "beyni" paylaşır: duruma göre ruh hâli, imleci izleyen gözler, göz kırpma, boşta kalınca uyku.

export type PetVariant = 'robot' | 'cube'

type Mood = PetMood

interface PetProps {
  variant: PetVariant
  state: AssistantState
  emotion?: EmotionSignal | null
  /** Gövde genişliği (px) */
  size?: number
  onClick?: () => void
  label?: string
  /** Kullanıcı yazarken 1 (Ana Sayfa'daki "heyecan"); pet komut kutusuna bakar */
  attention?: number
  /** Küçük hâli (çentik): sürükleme ve büyük efektler kapalı */
  compact?: boolean
  /** Üstüne belge sürükleniyor: ağzını açıp bekler */
  hungry?: boolean
  /** Komut kutusunda yazılan metnin uzunluğu; gözler harfleri takip eder */
  typed?: number
  /** Şu an çalışan aracın adı; ekranda ona uygun simge belirir */
  activity?: string | null
}

// Bu kadar süre hiçbir şey olmazsa pet uyur
const SLEEP_AFTER_MS = 3 * 60_000
const EMOTION_MS = { success: 1800, error: 2400 } as const

// Ruh hâline göre gövdenin hareketi (sürekli tekrar eden ya da tek seferlik)
const BODY: Record<Mood, TargetAndTransition> = {
  idle: {
    y: [0, -6, 0],
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
  },
  listen: {
    y: -4,
    rotate: 0,
    scaleX: [1, 0.97, 1],
    scaleY: [1, 1.05, 1],
    transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' }
  },
  think: {
    y: -2,
    rotate: [-4, 4, -4],
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
  },
  work: {
    y: [0, -4, 0],
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 0.55, repeat: Infinity, ease: 'easeInOut' }
  },
  speak: {
    y: -2,
    rotate: 0,
    scaleX: [1, 1.025, 1],
    scaleY: [1, 1.03, 1],
    transition: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' }
  },
  approval: {
    y: [0, -3, 0],
    rotate: -6,
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
  },
  // Zafer dansı: zıplar, sağa sola kıvırır, bir daha zıplar
  happy: {
    y: [0, -30, 0, -6, 0, -6, 0, -14, 0],
    rotate: [0, -6, 4, -10, 10, -10, 10, 0, 0],
    scaleX: [1, 0.92, 1.1, 1, 1, 1, 1, 0.95, 1],
    scaleY: [1, 1.1, 0.88, 1, 1, 1, 1, 1.06, 1],
    transition: { duration: 1.6, ease: 'easeOut' }
  },
  sad: {
    y: 5,
    rotate: 0,
    scaleX: 1.07,
    scaleY: 0.88,
    transition: { type: 'spring', stiffness: 160, damping: 14 }
  },
  // Horlar: yavaşça şişer, sonra kendi horlamasıyla irkilip uyanır gibi olur
  sleep: {
    y: [4, 4, 4, -6, 4],
    rotate: [3, 3, 3, -4, 3],
    scaleX: [1.02, 1.07, 1.02, 0.97, 1.02],
    scaleY: [0.97, 0.91, 0.97, 1.06, 0.97],
    transition: { duration: 7, times: [0, 0.4, 0.8, 0.85, 1], repeat: Infinity }
  },
  // Küs: arkasını yarı döner, omuzları düşük
  sulk: {
    y: 3,
    rotate: -10,
    scaleX: 0.94,
    scaleY: 0.97,
    transition: { type: 'spring', stiffness: 160, damping: 14 }
  },
  shy: {
    y: 2,
    rotate: [-4, 4, -4],
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
  },
  tickle: {
    y: [0, -8, 0],
    rotate: [-7, 7, -7],
    scaleX: [1, 1.05, 1],
    scaleY: [1, 0.95, 1],
    transition: { duration: 0.22, repeat: Infinity }
  },
  dizzy: {
    y: 2,
    rotate: [-12, 10, -12],
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
  },
  angry: {
    y: [0, -2, 0],
    rotate: [-2, 2, -2],
    scaleX: 1.04,
    scaleY: 0.95,
    transition: { duration: 0.12, repeat: Infinity }
  },
  bored: {
    y: 4,
    rotate: -4,
    scaleX: [1.02, 1.04, 1.02],
    scaleY: [0.98, 0.96, 0.98],
    transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
  }
}

// Tepkiler ve süreleri (ms)
type Reaction = 'happy' | 'tickle' | 'dizzy' | 'angry' | 'shy' | 'sulk'
const REACTION_MS: Record<Reaction, number> = {
  happy: 1600,
  tickle: 1800,
  dizzy: 2600,
  angry: 2600,
  shy: 2200,
  sulk: 3500
}
// Etkileşimlerin mutluluğa etkisi
const REACTION_BOND: Record<Reaction, number> = {
  happy: 8,
  tickle: 5,
  shy: 12,
  dizzy: -3,
  angry: -8,
  sulk: 0
}
// Bu kadar süre etkileşim olmazsa canı sıkılır (uykudan önce)
const BORED_AFTER_MS = 45_000

type Fidget =
  | 'look'
  | 'hop'
  | 'tilt'
  | 'wiggle'
  | 'wave'
  | 'spin'
  | 'dance'
  | 'sneeze'
  | 'stretch'
  | 'yawn'
  | 'game'
const FIDGETS: Fidget[] = [
  'look',
  'hop',
  'tilt',
  'wiggle',
  'look',
  'wave',
  'spin',
  'dance',
  'sneeze',
  'stretch',
  'game'
]
// Eli de kullanan hareketler (bitince eller dinlenme konumuna döner)
const HAND_FIDGETS: Partial<Record<Fidget, HandGesture>> = {
  wave: 'wave',
  dance: 'dance',
  stretch: 'stretch',
  yawn: 'stretch',
  game: 'game'
}

// Sabah ilk açılışta esneyerek uyanır, diğer açılışlarda el sallar
function firstGreeting(): Fidget {
  const now = new Date()
  if (now.getHours() < 5 || now.getHours() >= 11) return 'wave'
  const today = now.toDateString()
  try {
    if (localStorage.getItem('jarvis-pet-yawn') === today) return 'wave'
    localStorage.setItem('jarvis-pet-yawn', today)
  } catch {
    // Depolama yoksa her sabah açılışında esner
  }
  return 'yawn'
}

// Kendi kendine yapılan küçük hareketlerin gövde ve göz hareketi (tek seferlik)
const FIDGET_BODY: Record<Fidget, TargetAndTransition> = {
  look: {},
  hop: {
    y: [0, -16, 0, -5, 0],
    scaleX: [1, 0.94, 1.06, 0.98, 1],
    scaleY: [1, 1.07, 0.93, 1.02, 1],
    transition: { duration: 0.8, ease: 'easeOut' }
  },
  tilt: { rotate: [0, -11, -11, 0], transition: { duration: 1.1, times: [0, 0.25, 0.75, 1] } },
  wiggle: { rotate: [0, 4, -4, 3, -2, 0], transition: { duration: 0.7 } },
  wave: { rotate: [0, -4, 0], transition: { duration: 1.3 } },
  // Havada takla
  spin: {
    rotate: [0, 360],
    y: [0, -24, 0],
    transition: { duration: 0.8, ease: 'easeInOut' }
  },
  dance: {
    rotate: [0, -8, 8, -8, 8, 0],
    y: [0, -6, 0, -6, 0, 0],
    transition: { duration: 1.6 }
  },
  // Ha... ha... hapşu!
  sneeze: {
    scaleY: [1, 1.08, 1.1, 0.84, 1],
    y: [0, -4, -6, 8, 0],
    rotate: [0, -6, -9, 12, 0],
    transition: { duration: 1.1, times: [0, 0.35, 0.6, 0.7, 1] }
  },
  yawn: {
    scaleY: [1, 1.16, 1.16, 1.16, 1],
    scaleX: [1, 0.92, 0.92, 0.92, 1],
    rotate: [0, -4, 4, -2, 0],
    transition: { duration: 2.4, times: [0, 0.25, 0.5, 0.75, 1] }
  },
  // Gizlice ekranında oyun oynar
  game: {
    y: [0, 2, 0, 2, 0],
    transition: { duration: 4.5 }
  },
  stretch: {
    scaleY: [1, 1.14, 1.14, 1],
    scaleX: [1, 0.93, 0.93, 1],
    transition: { duration: 1.4, times: [0, 0.3, 0.75, 1] }
  }
}

function moodFor(
  state: AssistantState,
  emotion: 'success' | 'error' | null,
  asleep: boolean
): Mood {
  if (emotion === 'success') return 'happy'
  if (emotion === 'error') return 'sad'
  switch (state) {
    case 'approval':
      return 'approval'
    case 'listening':
      return 'listen'
    case 'thinking':
      return 'think'
    case 'working':
      return 'work'
    case 'speaking':
      return 'speak'
    default:
      return asleep ? 'sleep' : 'idle'
  }
}

function Pet({
  variant,
  state,
  emotion = null,
  size = 170,
  onClick,
  label = 'Jarvis ile konuş',
  attention = 0,
  typed = 0,
  compact = false,
  hungry = false,
  activity = null
}: PetProps): React.JSX.Element {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLButtonElement>(null)
  const [activeEmotion, setActiveEmotion] = useState<'success' | 'error' | null>(null)
  const [asleep, setAsleep] = useState(false)
  const [blinking, setBlinking] = useState(false)

  // Kısa duygu: iş bitti / hata bir süre görünür
  const emotionSeq = emotion?.seq
  const emotionKind = emotion?.kind
  useEffect(() => {
    if (emotionKind !== 'success' && emotionKind !== 'error') return
    if (emotionKind === 'success') bumpBond(4)
    const show = setTimeout(() => setActiveEmotion(emotionKind), 0)
    const hide = setTimeout(() => setActiveEmotion(null), EMOTION_MS[emotionKind])
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [emotionSeq, emotionKind])

  // Uyku: uzun süre fare/klavye hareketi ve iş olmazsa uyur, ilk harekette uyanır
  const [bored, setBored] = useState(false)
  useEffect(() => {
    let timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS)
    let boredTimer = setTimeout(() => setBored(true), BORED_AFTER_MS)
    const wake = (): void => {
      clearTimeout(timer)
      clearTimeout(boredTimer)
      setAsleep(false)
      setBored(false)
      timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS)
      boredTimer = setTimeout(() => setBored(true), BORED_AFTER_MS)
    }
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(timer)
      clearTimeout(boredTimer)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [state])

  // Göz kırpma: 3-6 sn arayla, bazen çift
  useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          setBlinking(true)
          timer = setTimeout(() => {
            setBlinking(false)
            schedule()
          }, 130)
        },
        Math.random() < 0.15 ? 250 : 3000 + Math.random() * 3000
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [reduced])

  // İmleç takibi (yeniden çizim olmadan, yaylı): gözler geniş açıyla bakar, gövde o tarafa
  // eğilip kayar, anten geriden gelip sallanır (jöle gibi)
  const lookX = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 })
  const lookY = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 })
  const leanX = useSpring(useMotionValue(0), { stiffness: 90, damping: 14 })
  const leanRotate = useSpring(useMotionValue(0), { stiffness: 90, damping: 12 })
  const antennaSource = useMotionValue(0)
  const antennaRotate = useSpring(antennaSource, { stiffness: 90, damping: 7 })
  useEffect(() => {
    if (reduced) return
    const onMove = (event: PointerEvent): void => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      // Uzaktaki imlece de bakar (600 px'te doygunluk)
      const pull = Math.min(dist / 600, 1)
      const nx = (dx / dist) * pull
      const ny = (dy / dist) * pull
      lookX.set(nx * size * 0.1)
      lookY.set(ny * size * 0.07)
      leanX.set(nx * size * 0.09)
      leanRotate.set(nx * 10)
      antennaSource.set(-nx * 12)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [lookX, lookY, leanX, leanRotate, antennaSource, size, reduced])

  // Kişilik tepkileri: başını okşayınca sevinir, karnını gıdıklayınca güler, hızlı sallanınca
  // başı döner, art arda sürüklenince sinirlenir
  const [reaction, setReaction] = useState<{ kind: Reaction; key: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragMoved = useRef(false)
  const dragPath = useRef(0)
  const dragTimes = useRef<number[]>([])
  const rub = useRef({ lastX: 0, dir: 0, turns: 0, at: 0 })
  useEffect(() => {
    if (!reaction) return
    const end = setTimeout(() => setReaction(null), REACTION_MS[reaction.kind])
    return () => clearTimeout(end)
  }, [reaction])
  const react = (kind: Reaction): void => {
    setReaction({ kind, key: Date.now() })
    bumpBond(REACTION_BOND[kind])
  }
  useEffect(
    () =>
      onPetSignal((signal) => {
        if (signal === 'praise') {
          setReaction({ kind: 'shy', key: Date.now() })
          bumpBond(REACTION_BOND.shy)
        }
      }),
    []
  )
  const bond = useBond()
  const stage = bondStage(bond)
  const bondRef = useRef({ happiness: bond.happiness, stage })
  useEffect(() => {
    bondRef.current = { happiness: bond.happiness, stage }
  }, [bond.happiness, stage])
  // 6 saatten uzun ayrı kalınca önce küser ("nihayet…"), sonra barışır
  const [awayHours] = useState(() => (compact ? 0 : openBond()))
  useEffect(() => {
    if (reduced || awayHours < 6) return
    const start = setTimeout(() => setReaction({ kind: 'sulk', key: Date.now() }), 400)
    return () => clearTimeout(start)
  }, [awayHours, reduced])
  // Gece yarısından sonra pijama başlığı takar
  const [night] = useState(() => new Date().getHours() < 5)
  const onRub = (event: React.PointerEvent): void => {
    if (reduced || dragging) return
    const r = rub.current
    const dx = event.clientX - r.lastX
    r.lastX = event.clientX
    if (Math.abs(dx) < 3) return
    const dir = Math.sign(dx)
    const now = performance.now()
    if (now - r.at > 700) r.turns = 0
    if (dir !== r.dir) {
      r.dir = dir
      r.turns += 1
      r.at = now
      if (r.turns >= 4) {
        r.turns = 0
        const rect = rootRef.current?.getBoundingClientRect()
        const belly = rect ? event.clientY > rect.top + rect.height * 0.6 : false
        react(belly ? 'tickle' : 'happy')
      }
    }
  }

  const baseMood = moodFor(state, activeEmotion, asleep)
  const calm = baseMood === 'idle' || baseMood === 'sleep'
  const mood: Mood =
    reaction && (calm || reaction.kind === 'shy')
      ? reaction.kind
      : baseMood === 'idle' && (bored || bond.happiness < 25)
        ? 'bored'
        : baseMood
  const height = size * 0.84
  const glowing = mood === 'work' || mood === 'listen' || mood === 'speak'

  // Boştayken kendi kendine küçük hareketler: etrafa bakınma, minik zıplama, baş eğme, anten
  // sallama. Üstüne gelince sevinip sıçrar. Her yeni hareket kendi anahtarıyla bir kez oynar.
  // Açılışta el sallayarak selam verir
  const [fidget, setFidget] = useState<{ kind: Fidget; key: number } | null>(() =>
    reduced ? null : { kind: firstGreeting(), key: 1 }
  )
  // Ellerin anahtarı sadece yeni bir el hareketi başlayınca değişir; böylece eller
  // durumlar arasında yumuşakça geçer, bir yerden bir yere ışınlanmaz
  const [handKey, setHandKey] = useState(1)
  const startFidget = (kind: Fidget): void => {
    const key = Date.now()
    setFidget({ kind, key })
    if (HAND_FIDGETS[kind]) setHandKey(key)
  }
  const [hovered, setHovered] = useState(false)
  const shyAt = useRef(0)
  useEffect(() => {
    if (reduced || mood !== 'idle') return
    let timer: ReturnType<typeof setTimeout>
    const next = (): void => {
      timer = setTimeout(
        () => {
          const { happiness, stage: bondLevel } = bondRef.current
          const pool: Fidget[] =
            happiness < 40
              ? FIDGETS.filter((kind) => kind !== 'spin' && kind !== 'dance')
              : bondLevel === 'buddy'
                ? [...FIDGETS, 'dance', 'spin', 'game']
                : FIDGETS
          startFidget(pool[Math.floor(Math.random() * pool.length)])
          next()
        },
        (3000 + Math.random() * 4000) *
          (bondRef.current.happiness > 70 ? 0.7 : bondRef.current.happiness < 40 ? 1.6 : 1)
      )
    }
    next()
    return () => clearTimeout(timer)
  }, [mood, reduced])
  // Anten zıplamalarda ve anten sallamada ekstra dalgalanır
  useEffect(() => {
    if (!fidget || reduced) return
    if (fidget.kind === 'wiggle' || fidget.kind === 'hop') {
      antennaSource.set(antennaSource.get() + (fidget.kind === 'wiggle' ? 18 : -12))
      const back = setTimeout(() => antennaSource.set(0), 140)
      return () => clearTimeout(back)
    }
    return undefined
  }, [fidget, antennaSource, reduced])

  // Yazarken komut kutusuna (aşağı) bakar ve başını sallar
  const watching = attention > 0 && mood === 'idle'
  // Üstüne gelinince ya da yazarken gözler merakla büyür
  const sneezing = mood === 'idle' && fidget?.kind === 'sneeze'
  const yawning = mood === 'idle' && fidget?.kind === 'yawn'
  // Oyun oynarken üstüne gelinirse hemen kapatıp masum masum bakar
  const gaming = mood === 'idle' && fidget?.kind === 'game' && !hovered && !watching
  // Yazarken gözler harflerle birlikte sağa kayar
  const typingX = ((Math.min(typed, 40) / 40) * 2 - 1) * size * 0.08
  const eyeMood: Mood =
    dragging || hungry
      ? 'listen'
      : sneezing
        ? 'tickle'
        : yawning
          ? 'sleep'
          : mood === 'idle' && (hovered || watching)
            ? 'listen'
            : mood
  const ActivityIcon = mood === 'work' ? toolIcon(activity) : null
  const fidgetHands = mood === 'idle' && fidget ? HAND_FIDGETS[fidget.kind] : undefined
  const gesture: HandGesture = dragging ? 'happy' : (fidgetHands ?? mood)
  const antenna = ANTENNA_COLOR[mood]

  return (
    <motion.button
      ref={rootRef}
      type="button"
      onClick={() => {
        if (dragMoved.current) {
          dragMoved.current = false
          return
        }
        onClick?.()
      }}
      onPointerMove={onRub}
      drag={!reduced && !compact}
      dragSnapToOrigin
      dragElastic={0.35}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 14 }}
      onDragStart={() => {
        dragMoved.current = true
        dragPath.current = 0
        const now = Date.now()
        dragTimes.current = [...dragTimes.current.filter((t) => now - t < 12_000), now]
        setDragging(true)
      }}
      onDrag={(_, info) => {
        dragPath.current += Math.hypot(info.delta.x, info.delta.y)
      }}
      onDragEnd={() => {
        setDragging(false)
        if (dragTimes.current.length >= 3) {
          dragTimes.current = []
          react('angry')
        } else if (dragPath.current > 1200) react('dizzy')
      }}
      aria-label={label}
      title={label}
      className="relative flex cursor-pointer flex-col items-center rounded-[32px] outline-offset-8"
      onHoverStart={() => {
        setHovered(true)
        const now = Date.now()
        if (stage === 'shy' && mood === 'idle' && !reduced && now - shyAt.current > 20_000) {
          shyAt.current = now
          setReaction({ kind: 'shy', key: now })
        }
      }}
      onHoverEnd={() => setHovered(false)}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.93 }}
      whileDrag={{ scale: 1.08, rotate: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
    >
      {/* Robotun üst boşluğu: anten gövdenin üstünde durur */}
      <div style={{ height: variant === 'robot' ? size * 0.18 : 0 }} />
      {/* Eğilme: imlecin olduğu tarafa döner ve kayar */}
      <motion.div style={{ x: leanX, rotate: leanRotate, transformOrigin: '50% 100%' }}>
        {/* Kendi kendine küçük hareketler (zıplama, baş eğme, sallanma) */}
        <motion.div
          key={fidget?.key ?? 0}
          className="relative"
          style={{ transformOrigin: '50% 100%' }}
          animate={reduced || !fidget ? undefined : FIDGET_BODY[fidget.kind]}
        >
          {variant === 'robot' && !reduced && (
            <Hands gesture={gesture} width={size} height={height} gestureKey={handKey} />
          )}
          <motion.div
            className="relative"
            style={{ width: size, height, transformOrigin: '50% 100%' }}
            animate={reduced ? undefined : BODY[mood]}
          >
            {/* Anten (robot): gövdeye bağlı, geriden gelip sallanır; ucu çalışırken/dinlerken parlar */}
            {variant === 'robot' && (
              <motion.div
                className="absolute left-1/2"
                style={{
                  bottom: '100%',
                  width: size * 0.09,
                  height: size * 0.2,
                  marginLeft: -size * 0.045,
                  rotate: antennaRotate,
                  transformOrigin: '50% 100%'
                }}
              >
                <div
                  className="absolute left-1/2 rounded-full bg-white/35"
                  style={{
                    width: size * 0.035,
                    height: size * 0.14,
                    bottom: -size * 0.01,
                    marginLeft: -size * 0.0175
                  }}
                />
                <motion.div
                  className="absolute top-0 left-0 rounded-full"
                  style={{ width: size * 0.09, height: size * 0.09 }}
                  animate={{
                    backgroundColor: antenna,
                    boxShadow:
                      glowing || mood === 'approval' || mood === 'happy' || mood === 'sad'
                        ? [`0 0 6px ${antenna}`, `0 0 24px ${antenna}`, `0 0 6px ${antenna}`]
                        : `0 0 8px ${antenna}`,
                    opacity: mood === 'sleep' ? 0.5 : 1
                  }}
                  transition={{
                    backgroundColor: { duration: 0.4 },
                    default: {
                      duration: mood === 'approval' ? 1.4 : 0.9,
                      repeat: mood === 'sleep' || mood === 'idle' || mood === 'think' ? 0 : Infinity
                    }
                  }}
                />
              </motion.div>
            )}
            {/* Gövde */}
            <div
              className="absolute inset-0"
              style={
                variant === 'robot'
                  ? {
                      borderRadius: size * 0.36,
                      background:
                        'linear-gradient(180deg, rgb(255 255 255 / 0.2), rgb(255 255 255 / 0.05))',
                      border: '1px solid rgb(255 255 255 / 0.2)',
                      boxShadow:
                        'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -10px 24px rgb(139 155 255 / 0.12), 0 18px 40px -10px rgb(0 0 0 / 0.65)',
                      backdropFilter: 'blur(14px)'
                    }
                  : {
                      borderRadius: size * 0.27,
                      background: 'linear-gradient(145deg, #aeb9ff 0%, #8b9bff 40%, #626ae0 100%)',
                      boxShadow:
                        'inset 0 3px 3px rgb(255 255 255 / 0.55), inset 0 -10px 18px rgb(40 40 140 / 0.55), 0 16px 40px -8px rgb(139 155 255 / 0.55)'
                    }
              }
            />
            {/* Jöle parlaması */}
            {variant === 'cube' && (
              <div
                className="absolute rounded-full bg-white/50 blur-[2px]"
                style={{
                  left: size * 0.14,
                  top: size * 0.07,
                  width: size * 0.26,
                  height: size * 0.09
                }}
              />
            )}
            {/* Ekran (yüz) */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: size * (variant === 'robot' ? 0.13 : 0.14),
                right: size * (variant === 'robot' ? 0.13 : 0.14),
                top: height * (variant === 'robot' ? 0.18 : 0.2),
                bottom: height * (variant === 'robot' ? 0.18 : 0.16),
                borderRadius: size * 0.22,
                background: '#0d0f24',
                boxShadow:
                  'inset 0 0 18px rgb(139 155 255 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.06)'
              }}
            >
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                style={{ x: lookX, y: lookY, gap: size * 0.13 }}
                animate={
                  ActivityIcon || mood === 'think' || mood === 'speak'
                    ? { scale: 0.82, translateY: -size * 0.045 }
                    : { scale: 1, translateY: 0 }
                }
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <motion.div
                  key={fidget?.kind === 'look' ? fidget.key : 'eyes'}
                  className="flex items-center"
                  style={{ gap: size * 0.13, opacity: gaming ? 0 : 1 }}
                  animate={
                    watching
                      ? {
                          x: typingX,
                          y: [size * 0.05, size * 0.08, size * 0.05],
                          transition: { duration: 0.6, repeat: Infinity }
                        }
                      : fidget?.kind === 'look' && mood === 'idle' && !reduced
                        ? {
                            x: [0, -size * 0.09, -size * 0.09, size * 0.09, size * 0.09, 0],
                            y: 0,
                            transition: { duration: 2, times: [0, 0.15, 0.4, 0.55, 0.85, 1] }
                          }
                        : { x: 0, y: 0 }
                  }
                >
                  <Eye mood={eyeMood} blinking={blinking} size={size} />
                  <Eye mood={eyeMood} blinking={blinking} size={size} right />
                </motion.div>
              </motion.div>
              <AnimatePresence>
                {ActivityIcon && (
                  <ScreenIcon key={activity ?? ''} icon={ActivityIcon} size={size} />
                )}
              </AnimatePresence>
              {mood === 'think' && !reduced && <ThinkingDots size={size} />}
              {mood === 'speak' && <SpeakingMouth size={size} />}
              {hungry && (
                <motion.span
                  className="absolute left-1/2 block rounded-full bg-[#c9d0ff]"
                  style={{
                    bottom: size * 0.04,
                    width: size * 0.16,
                    height: size * 0.14,
                    marginLeft: -size * 0.08,
                    boxShadow: '0 0 10px rgb(190 200 255 / 0.9)'
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: [0.7, 1, 0.7] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
              {yawning && (
                <motion.span
                  className="absolute left-1/2 block rounded-full bg-[#c9d0ff]"
                  style={{
                    bottom: size * 0.05,
                    width: size * 0.1,
                    height: size * 0.12,
                    marginLeft: -size * 0.05,
                    boxShadow: '0 0 10px rgb(190 200 255 / 0.9)'
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1, 1, 0] }}
                  transition={{ duration: 2.4, times: [0, 0.3, 0.75, 1] }}
                />
              )}
              <AnimatePresence>{gaming && <SnakeGame size={size} />}</AnimatePresence>
            </div>
            {(mood === 'happy' || mood === 'shy') && !reduced && (
              <FloatingHearts key={reaction?.key ?? emotionSeq} size={size} />
            )}
            {/* Okşanınca yanaklar kızarır */}
            {(mood === 'tickle' || mood === 'shy' || reaction?.kind === 'happy') &&
              [-1, 1].map((side) => (
                <motion.span
                  key={side}
                  className="pointer-events-none absolute rounded-full bg-[#ff8fbf] blur-[3px]"
                  style={{
                    top: height * 0.55,
                    left: side < 0 ? size * 0.2 : undefined,
                    right: side > 0 ? size * 0.2 : undefined,
                    width: size * 0.12,
                    height: size * 0.05
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                />
              ))}

            <ReactionExtras mood={mood} size={size} reduced={!!reduced || compact} night={night} />
            {night && !compact && variant === 'robot' && <NightCap size={size} />}
            {/* Onay bekliyor: amber ünlem balonu */}
            {mood === 'approval' && (
              <motion.div
                className="absolute flex items-center justify-center rounded-full font-bold text-[#3a2400]"
                style={{
                  right: -size * 0.08,
                  top: -size * 0.1,
                  width: size * 0.2,
                  height: size * 0.2,
                  fontSize: size * 0.12,
                  background: 'linear-gradient(145deg, #ffd27a, #f0a93a)',
                  boxShadow: '0 0 16px rgb(240 169 58 / 0.6)'
                }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14 }}
              >
                !
              </motion.div>
            )}

            {/* Uyku: uçan z'ler */}
            {mood === 'sleep' &&
              !reduced &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute font-semibold text-muted"
                  style={{
                    right: size * 0.02,
                    top: -size * 0.05,
                    fontSize: size * (0.08 + i * 0.02)
                  }}
                  initial={{ opacity: 0, x: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], x: size * 0.12, y: -size * 0.2 }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
                >
                  z
                </motion.span>
              ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Yer gölgesi: zıplarken küçülür */}
      <motion.div
        className="rounded-[50%] bg-black/50 blur-[4px]"
        style={{ width: size * 0.7, height: size * 0.08, marginTop: size * 0.06 }}
        animate={
          mood === 'happy'
            ? { scaleX: [1, 0.6, 1, 0.85, 1], opacity: [0.8, 0.4, 0.8, 0.6, 0.8] }
            : { scaleX: 1, opacity: mood === 'sleep' ? 0.9 : 0.75 }
        }
        transition={{ duration: 0.95 }}
      />
    </motion.button>
  )
}

interface EyeProps {
  mood: Mood
  blinking: boolean
  size: number
  right?: boolean
}

// Tek göz: ruh hâline göre biçim değiştirir (normal, büyük, ^ ^, üzgün, uykulu)
function Eye({ mood, blinking, size, right = false }: EyeProps): React.JSX.Element {
  const w = size * 0.1
  const h = size * 0.17
  const glow = '0 0 12px rgb(190 200 255 / 0.95)'

  if (mood === 'happy' || mood === 'shy') {
    return (
      <motion.span
        className="block"
        style={{
          width: w * 1.3,
          height: w * 0.75,
          borderTop: `${size * 0.03}px solid #f1f3ff`,
          borderLeft: `${size * 0.03}px solid #f1f3ff`,
          borderRight: `${size * 0.03}px solid #f1f3ff`,
          borderRadius: `${w}px ${w}px 0 0`,
          filter: 'drop-shadow(0 0 6px rgb(190 200 255 / 0.9))'
        }}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      />
    )
  }

  if (mood === 'tickle') {
    // Gülmekten kısılmış > < gözler
    const t = size * 0.03
    return (
      <motion.span
        className="block"
        style={{
          width: w * 0.9,
          height: w * 0.9,
          borderTop: `${t}px solid #f1f3ff`,
          borderRight: `${t}px solid #f1f3ff`,
          borderRadius: t * 0.5,
          filter: 'drop-shadow(0 0 6px rgb(190 200 255 / 0.9))'
        }}
        initial={{ scale: 0.6, rotate: right ? -135 : 45 }}
        animate={{ scale: 1, rotate: right ? -135 : 45 }}
      />
    )
  }
  if (mood === 'dizzy') {
    // Dönen sarmal gözler
    return (
      <motion.span
        className="block rounded-full"
        style={{
          width: w * 1.5,
          height: w * 1.5,
          border: `${size * 0.025}px solid #f1f3ff`,
          borderTopColor: 'transparent',
          borderRightColor: right ? 'transparent' : '#f1f3ff',
          filter: 'drop-shadow(0 0 6px rgb(190 200 255 / 0.9))'
        }}
        animate={{ rotate: right ? -360 : 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    )
  }

  const shape: Record<Mood, { w: number; h: number; rotate: number; y: number }> = {
    idle: { w, h, rotate: 0, y: 0 },
    listen: { w: w * 1.15, h: h * 1.2, rotate: 0, y: 0 },
    think: { w: w * 0.9, h: h * 0.75, rotate: 0, y: -size * 0.03 },
    work: { w, h: h * 0.85, rotate: 0, y: 0 },
    speak: { w, h, rotate: 0, y: 0 },
    approval: { w: w * 1.05, h: h * 1.05, rotate: 0, y: 0 },
    happy: { w, h, rotate: 0, y: 0 },
    sad: { w: w * 1.1, h: h * 0.28, rotate: right ? -14 : 14, y: size * 0.03 },
    sleep: { w: w * 1.1, h: size * 0.02, rotate: 0, y: size * 0.03 },
    tickle: { w, h, rotate: 0, y: 0 },
    dizzy: { w, h, rotate: 0, y: 0 },
    angry: { w: w * 1.15, h: h * 0.5, rotate: right ? 18 : -18, y: size * 0.01 },
    bored: { w: w * 1.1, h: h * 0.38, rotate: 0, y: size * 0.035 },
    shy: { w, h, rotate: 0, y: 0 },
    sulk: { w: w * 1.1, h: h * 0.4, rotate: right ? 10 : -10, y: size * 0.03 }
  }
  const s = shape[mood]
  return (
    <motion.span
      className="block rounded-full bg-[#f1f3ff]"
      style={{ boxShadow: glow }}
      animate={{
        width: s.w,
        height: blinking && mood !== 'sleep' ? size * 0.015 : s.h,
        rotate: s.rotate,
        y: s.y
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    />
  )
}

// Tepkilerin ek efektleri: sinirlenince buhar, başı dönünce tepesinde dönen yıldızlar,
// gıdıklanınca "hi hi", canı sıkılınca iç çekiş
function ReactionExtras({
  mood,
  size,
  reduced,
  night
}: {
  mood: Mood
  size: number
  reduced: boolean
  night: boolean
}): React.JSX.Element | null {
  if (reduced) return null
  if (mood === 'think') {
    // Uzun düşünürse (4 sn) tepesinde dişli çark döner
    return (
      <motion.span
        className="pointer-events-none absolute text-[#c9d0ff]"
        style={{ right: -size * 0.12, top: -size * 0.12 }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1, rotate: 360 }}
        transition={{
          opacity: { delay: 4, duration: 0.4 },
          scale: { delay: 4, type: 'spring', stiffness: 300, damping: 14 },
          rotate: { duration: 2.5, repeat: Infinity, ease: 'linear' }
        }}
      >
        <Settings
          style={{ width: size * 0.16, height: size * 0.16 }}
          className="drop-shadow-[0_0_6px_rgb(160_175_255_/_0.9)]"
        />
      </motion.span>
    )
  }
  if (mood === 'sleep') {
    // Rüya balonu: sırayla kalp, yıldız, kurabiye
    const dreams = [Heart, Star, Cookie]
    return (
      <span
        className="pointer-events-none absolute"
        style={{ left: -size * 0.32, top: -size * 0.28 }}
      >
        <span
          className="absolute rounded-full bg-white/15"
          style={{ left: size * 0.26, top: size * 0.24, width: size * 0.04, height: size * 0.04 }}
        />
        <span
          className="absolute rounded-full bg-white/15"
          style={{ left: size * 0.21, top: size * 0.18, width: size * 0.06, height: size * 0.06 }}
        />
        <span
          className="glass-soft absolute flex items-center justify-center !rounded-full"
          style={{ left: 0, top: 0, width: size * 0.22, height: size * 0.18 }}
        >
          {dreams.map((Icon, i) => (
            <motion.span
              key={i}
              className="absolute text-[#ffb3d1]"
              animate={{ opacity: [0, 1, 1, 0, 0] }}
              transition={{
                duration: 9,
                times: [0, 0.05, 0.28, 0.33, 1],
                repeat: Infinity,
                delay: i * 3
              }}
            >
              <Icon
                style={{ width: size * 0.09, height: size * 0.09 }}
                fill="currentColor"
                strokeWidth={0}
              />
            </motion.span>
          ))}
        </span>
      </span>
    )
  }
  if (mood === 'angry') {
    return (
      <>
        {[-1, 1, -1, 1].map((side, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white/70 blur-[2px]"
            style={{
              top: size * 0.02,
              left: side < 0 ? size * 0.12 : undefined,
              right: side > 0 ? size * 0.12 : undefined,
              width: size * 0.08,
              height: size * 0.08
            }}
            animate={{
              opacity: [0, 0.9, 0],
              y: -size * 0.3,
              x: side * size * 0.1,
              scale: [0.5, 1.4]
            }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22, ease: 'easeOut' }}
          />
        ))}
      </>
    )
  }
  if (mood === 'dizzy') {
    return (
      <motion.div
        className="pointer-events-none absolute left-1/2"
        style={{ top: -size * 0.1, width: 0, height: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 120, 240].map((deg) => (
          <span
            key={deg}
            className="absolute text-[#ffe08a]"
            style={{
              fontSize: size * 0.1,
              transform: `rotate(${deg}deg) translate(${size * 0.32}px) rotate(-${deg}deg)`,
              textShadow: '0 0 8px rgb(255 224 138 / 0.9)'
            }}
          >
            ★
          </span>
        ))}
      </motion.div>
    )
  }
  if (mood === 'sulk') {
    return (
      <motion.span
        className="pointer-events-none absolute font-semibold whitespace-nowrap text-[#8a90a8]"
        style={{ right: -size * 0.4, top: -size * 0.02, fontSize: size * 0.1 }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: -size * 0.08 }}
      >
        nihayet…
      </motion.span>
    )
  }
  if (mood === 'tickle' || mood === 'bored' || (night && mood === 'idle')) {
    const tickle = mood === 'tickle'
    const sleepy = night && mood === 'idle'
    return (
      <motion.span
        key={mood}
        className="pointer-events-none absolute font-semibold whitespace-nowrap"
        style={{
          top: -size * 0.02,
          fontSize: size * 0.1,
          color: tickle ? '#ff9ec7' : '#8a90a8',
          right: sleepy ? -size * 0.55 : -size * 0.25
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: [0, 1, 1, 0], y: -size * 0.12 }}
        transition={{
          duration: tickle ? 1.2 : 2.4,
          repeat: Infinity,
          repeatDelay: tickle ? 0 : sleepy ? 9 : 3
        }}
      >
        {tickle ? 'hi hi!' : sleepy ? 'uyusan mı artık?' : 'ıhh…'}
      </motion.span>
    )
  }
  return null
}

// Pijama başlığı (gece yarısından sonra)
function NightCap({ size }: { size: number }): React.JSX.Element {
  return (
    <motion.span
      className="pointer-events-none absolute block"
      style={{ left: size * 0.02, top: -size * 0.2, width: size * 0.4, height: size * 0.34 }}
      initial={{ rotate: -24 }}
      animate={{ rotate: [-24, -18, -24] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span
        className="absolute inset-0 block"
        style={{
          clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
          background: 'linear-gradient(160deg, #8b9bff, #4b4fb8)'
        }}
      />
      <span
        className="absolute block rounded-full"
        style={{
          left: 0,
          right: 0,
          bottom: -size * 0.02,
          height: size * 0.07,
          background: '#e8ebff'
        }}
      />
      <span
        className="absolute block rounded-full bg-[#e8ebff]"
        style={{
          left: '50%',
          top: -size * 0.04,
          width: size * 0.08,
          height: size * 0.08,
          marginLeft: -size * 0.04,
          boxShadow: '0 0 8px rgb(232 235 255 / 0.8)'
        }}
      />
    </motion.span>
  )
}

export default Pet
