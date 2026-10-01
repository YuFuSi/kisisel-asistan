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
import { FloatingHearts, Hands, ScreenIcon, ThinkingDots } from './petParts'
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
  happy: {
    y: [0, -30, 0, -12, 0],
    rotate: [0, -6, 4, 0, 0],
    scaleX: [1, 0.92, 1.1, 0.97, 1],
    scaleY: [1, 1.1, 0.88, 1.04, 1],
    transition: { duration: 0.95, ease: 'easeOut' }
  },
  sad: {
    y: 5,
    rotate: 0,
    scaleX: 1.07,
    scaleY: 0.88,
    transition: { type: 'spring', stiffness: 160, damping: 14 }
  },
  sleep: {
    y: 4,
    rotate: 3,
    scaleX: [1.02, 1.05, 1.02],
    scaleY: [0.97, 0.94, 0.97],
    transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
  }
}

type Fidget = 'look' | 'hop' | 'tilt' | 'wiggle' | 'wave'
const FIDGETS: Fidget[] = ['look', 'hop', 'tilt', 'wiggle', 'look', 'wave']

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
  wave: { rotate: [0, -4, 0], transition: { duration: 1.05 } }
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
    const show = setTimeout(() => setActiveEmotion(emotionKind), 0)
    const hide = setTimeout(() => setActiveEmotion(null), EMOTION_MS[emotionKind])
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [emotionSeq, emotionKind])

  // Uyku: uzun süre fare/klavye hareketi ve iş olmazsa uyur, ilk harekette uyanır
  useEffect(() => {
    let timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS)
    const wake = (): void => {
      clearTimeout(timer)
      setAsleep(false)
      timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS)
    }
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(timer)
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

  const mood = moodFor(state, activeEmotion, asleep)
  const height = size * 0.84
  const glowing = mood === 'work' || mood === 'listen' || mood === 'speak'

  // Boştayken kendi kendine küçük hareketler: etrafa bakınma, minik zıplama, baş eğme, anten
  // sallama. Üstüne gelince sevinip sıçrar. Her yeni hareket kendi anahtarıyla bir kez oynar.
  // Açılışta el sallayarak selam verir
  const [fidget, setFidget] = useState<{ kind: Fidget; key: number } | null>(() =>
    reduced ? null : { kind: 'wave', key: 1 }
  )
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (reduced || mood !== 'idle') return
    let timer: ReturnType<typeof setTimeout>
    const next = (): void => {
      timer = setTimeout(
        () => {
          setFidget({ kind: FIDGETS[Math.floor(Math.random() * FIDGETS.length)], key: Date.now() })
          next()
        },
        3000 + Math.random() * 4000
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
  const eyeMood: Mood = mood === 'idle' && (hovered || watching) ? 'listen' : mood
  const ActivityIcon = mood === 'work' ? toolIcon(activity) : null
  const gesture: HandGesture = mood === 'idle' && fidget?.kind === 'wave' ? 'wave' : mood
  const gestureKey = gesture === 'wave' ? (fidget?.key ?? 0) : 0
  const antenna = ANTENNA_COLOR[mood]

  return (
    <motion.button
      ref={rootRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex cursor-pointer flex-col items-center rounded-[32px] outline-offset-8"
      onHoverStart={() => {
        setHovered(true)
        if (!reduced && mood === 'idle') setFidget({ kind: 'hop', key: Date.now() })
      }}
      onHoverEnd={() => setHovered(false)}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.93 }}
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
            <Hands gesture={gesture} width={size} height={height} gestureKey={gestureKey} />
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
                  ActivityIcon || mood === 'think'
                    ? { scale: 0.82, translateY: -size * 0.045 }
                    : { scale: 1, translateY: 0 }
                }
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <motion.div
                  key={fidget?.kind === 'look' ? fidget.key : 'eyes'}
                  className="flex items-center"
                  style={{ gap: size * 0.13 }}
                  animate={
                    watching
                      ? {
                          x: 0,
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
            </div>
            {mood === 'happy' && !reduced && <FloatingHearts key={emotionSeq} size={size} />}

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

  if (mood === 'happy') {
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

  const shape: Record<Mood, { w: number; h: number; rotate: number; y: number }> = {
    idle: { w, h, rotate: 0, y: 0 },
    listen: { w: w * 1.15, h: h * 1.2, rotate: 0, y: 0 },
    think: { w: w * 0.9, h: h * 0.75, rotate: 0, y: -size * 0.03 },
    work: { w, h: h * 0.85, rotate: 0, y: 0 },
    speak: { w, h, rotate: 0, y: 0 },
    approval: { w: w * 1.05, h: h * 1.05, rotate: 0, y: 0 },
    happy: { w, h, rotate: 0, y: 0 },
    sad: { w: w * 1.1, h: h * 0.28, rotate: right ? -14 : 14, y: size * 0.03 },
    sleep: { w: w * 1.1, h: size * 0.02, rotate: 0, y: size * 0.03 }
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

export default Pet
