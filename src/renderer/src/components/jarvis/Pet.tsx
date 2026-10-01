import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type TargetAndTransition
} from 'motion/react'
import type { AssistantState, EmotionSignal } from '../../lib/assistantState'

// Jarvis'in pet karakteri (prototip "Jarvis Cam"): cam robot ya da jöle küp. İki görünüm aynı
// "beyni" paylaşır: duruma göre ruh hâli, imleci izleyen gözler, göz kırpma, boşta kalınca uyku.

export type PetVariant = 'robot' | 'cube'

type Mood = 'idle' | 'listen' | 'think' | 'work' | 'speak' | 'approval' | 'happy' | 'sad' | 'sleep'

interface PetProps {
  variant: PetVariant
  state: AssistantState
  emotion?: EmotionSignal | null
  /** Gövde genişliği (px) */
  size?: number
  onClick?: () => void
  label?: string
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
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
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
  label = 'Jarvis ile konuş'
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

  // Gözler imleci izler (yeniden çizim olmadan, yaylı)
  const lookX = useSpring(useMotionValue(0), { stiffness: 140, damping: 16 })
  const lookY = useSpring(useMotionValue(0), { stiffness: 140, damping: 16 })
  useEffect(() => {
    if (reduced) return
    const onMove = (event: PointerEvent): void => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      const pull = Math.min(dist / 300, 1)
      lookX.set((dx / dist) * pull * size * 0.05)
      lookY.set((dy / dist) * pull * size * 0.035)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [lookX, lookY, size, reduced])

  const mood = moodFor(state, activeEmotion, asleep)
  const height = size * 0.84
  const glowing = mood === 'work' || mood === 'listen' || mood === 'speak'

  return (
    <motion.button
      ref={rootRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex cursor-pointer flex-col items-center rounded-[32px] outline-offset-8"
      whileHover={reduced ? undefined : { scale: 1.04 }}
      whileTap={reduced ? undefined : { scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
    >
      {/* Anten (robot): ucu çalışırken/dinlerken parlar */}
      {variant === 'robot' && (
        <div className="relative" style={{ height: size * 0.18 }}>
          <div
            className="mx-auto rounded-full bg-white/35"
            style={{ width: size * 0.035, height: size * 0.14, marginTop: size * 0.04 }}
          />
          <motion.div
            className="absolute left-1/2 rounded-full"
            style={{
              width: size * 0.09,
              height: size * 0.09,
              top: 0,
              marginLeft: -size * 0.045,
              background: '#a3b0ff'
            }}
            animate={{
              boxShadow: glowing
                ? ['0 0 6px #8b9bff', '0 0 22px #a3b0ff', '0 0 6px #8b9bff']
                : '0 0 8px #8b9bff',
              opacity: mood === 'sleep' ? 0.35 : 1
            }}
            transition={{ duration: 0.9, repeat: glowing ? Infinity : 0 }}
          />
        </div>
      )}

      <motion.div
        className="relative"
        style={{ width: size, height, transformOrigin: '50% 100%' }}
        animate={reduced ? undefined : BODY[mood]}
      >
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
          >
            <Eye mood={mood} blinking={blinking} size={size} />
            <Eye mood={mood} blinking={blinking} size={size} right />
          </motion.div>
        </div>

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
              style={{ right: size * 0.02, top: -size * 0.05, fontSize: size * (0.08 + i * 0.02) }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], x: size * 0.12, y: -size * 0.2 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
            >
              z
            </motion.span>
          ))}
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
