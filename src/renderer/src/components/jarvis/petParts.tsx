import { motion, type TargetAndTransition } from 'motion/react'
import { Heart, type LucideIcon } from 'lucide-react'
import type { HandGesture } from '../../lib/petLook'

// Pet'in yardımcı parçaları: ekran simgeleri, anten rengi ve yüzen eller (prototip "Jarvis Cam")

/** Ekranın alt kısmında beliren araç simgesi */
export function ScreenIcon({
  icon: Icon,
  size
}: {
  icon: LucideIcon
  size: number
}): React.JSX.Element {
  return (
    <motion.span
      className="absolute left-1/2 flex items-center justify-center text-[#c9d0ff]"
      style={{
        bottom: size * 0.04,
        marginLeft: -size * 0.07,
        width: size * 0.14,
        height: size * 0.14
      }}
      initial={{ opacity: 0, scale: 0.4, y: 6 }}
      animate={{ opacity: 1, scale: [1, 1.08, 1], y: 0 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{
        scale: { duration: 1.2, repeat: Infinity },
        default: { type: 'spring', stiffness: 400, damping: 18 }
      }}
    >
      <Icon
        style={{
          width: size * 0.12,
          height: size * 0.12,
          filter: 'drop-shadow(0 0 6px rgb(160 175 255 / 0.9))'
        }}
        strokeWidth={2.4}
      />
    </motion.span>
  )
}

/** Düşünürken gözlerin altında sırayla parlayan üç nokta */
export function ThinkingDots({ size }: { size: number }): React.JSX.Element {
  return (
    <span
      className="absolute left-1/2 flex -translate-x-1/2"
      style={{ bottom: size * 0.07, gap: size * 0.03 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block rounded-full bg-[#c9d0ff]"
          style={{ width: size * 0.03, height: size * 0.03 }}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -size * 0.015, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

/** Sevinince ekranın üstünden uçup giden kalpler */
export function FloatingHearts({ size }: { size: number }): React.JSX.Element {
  return (
    <>
      {[-1, 0, 1].map((side, i) => (
        <motion.span
          key={side}
          className="pointer-events-none absolute left-1/2 text-[#ff9ec7]"
          style={{ top: 0 }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 0],
            x: side * size * 0.28,
            y: -size * 0.45,
            scale: [0.4, 1, 0.8]
          }}
          transition={{ duration: 1.3, delay: i * 0.12, ease: 'easeOut' }}
        >
          <Heart
            style={{
              width: size * 0.11,
              height: size * 0.11,
              filter: 'drop-shadow(0 0 6px rgb(255 120 180 / 0.8))'
            }}
            fill="currentColor"
            strokeWidth={0}
          />
        </motion.span>
      ))}
    </>
  )
}

// El hareketleri: dinlenme konumuna göre kayma (gövde boyunun oranı) ve dönüş.
// Sol el, sağ elin aynası; bazı hareketler (el sallama, çene tutma) sadece sağ elde.
function gestureFor(
  gesture: HandGesture,
  right: boolean,
  w: number,
  h: number
): TargetAndTransition {
  const dir = right ? 1 : -1
  switch (gesture) {
    case 'wave':
      return right
        ? {
            x: -w * 0.02,
            y: -h * 0.62,
            rotate: [0, 28, -12, 28, -12, 20, 0],
            transition: { duration: 1.8, ease: 'easeInOut' }
          }
        : { x: 0, y: [0, -4, 0], rotate: 0, transition: { duration: 3, repeat: Infinity } }
    case 'happy':
      return {
        x: -dir * w * 0.04,
        y: [-h * 0.55, -h * 0.68, -h * 0.55],
        rotate: [dir * 10, -dir * 10, dir * 10],
        transition: { duration: 0.45, repeat: 3 }
      }
    case 'think':
      return right
        ? {
            x: -w * 0.4,
            y: [h * 0.22, h * 0.19, h * 0.22],
            rotate: -20,
            transition: {
              y: { duration: 0.8, repeat: Infinity },
              default: { type: 'spring', stiffness: 140, damping: 16 }
            }
          }
        : { x: 0, y: [0, -3, 0], rotate: 0, transition: { duration: 3, repeat: Infinity } }
    case 'listen':
      return {
        x: -dir * w * 0.06,
        y: -h * 0.18,
        rotate: dir * 15,
        transition: { type: 'spring', stiffness: 160, damping: 14 }
      }
    case 'work':
      return {
        x: -dir * w * 0.1,
        y: right ? [h * 0.05, -h * 0.02, h * 0.05] : [-h * 0.02, h * 0.05, -h * 0.02],
        rotate: 0,
        transition: { duration: 0.32, repeat: Infinity }
      }
    case 'speak':
      return right
        ? {
            x: w * 0.02,
            y: [-h * 0.12, -h * 0.2, -h * 0.12],
            rotate: [0, 14, 0],
            transition: { duration: 1.1, repeat: Infinity }
          }
        : { x: 0, y: [0, -4, 0], rotate: 0, transition: { duration: 3, repeat: Infinity } }
    case 'approval':
      return right
        ? {
            x: -w * 0.04,
            y: -h * 0.5,
            rotate: -8,
            transition: { type: 'spring', stiffness: 200, damping: 12 }
          }
        : { x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } }
    case 'sad':
      return {
        x: -dir * w * 0.02,
        y: h * 0.14,
        rotate: dir * 25,
        transition: { type: 'spring', stiffness: 90, damping: 14 }
      }
    case 'sleep':
      return { x: -dir * w * 0.04, y: h * 0.16, rotate: dir * 10, transition: { duration: 1.2 } }
    default:
      return {
        x: 0,
        y: [0, -5, 0],
        rotate: 0,
        transition: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: right ? 0.6 : 0 }
      }
  }
}

interface HandsProps {
  gesture: HandGesture
  /** Gövde genişliği ve yüksekliği (px) */
  width: number
  height: number
  /** Her yeni el hareketinde değişir; aynı hareket yeniden oynasın */
  gestureKey: number
}

/** Gövdenin iki yanında süzülen cam eller */
export function Hands({ gesture, width, height, gestureKey }: HandsProps): React.JSX.Element {
  const hand = width * 0.19
  return (
    <>
      {[false, true].map((right) => (
        <motion.span
          key={`${right}-${gestureKey}`}
          className="pointer-events-none absolute block"
          style={{
            width: hand,
            height: hand * 0.92,
            top: height * 0.56,
            left: right ? width + width * 0.05 : -hand - width * 0.05,
            borderRadius: hand * 0.46,
            background: 'linear-gradient(180deg, rgb(200 208 255 / 0.32), rgb(139 155 255 / 0.1))',
            border: '1px solid rgb(255 255 255 / 0.22)',
            boxShadow:
              'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 8px 18px -6px rgb(0 0 0 / 0.6), 0 0 16px rgb(139 155 255 / 0.3)',
            transformOrigin: '50% 80%'
          }}
          animate={gestureFor(gesture, right, width, height)}
        />
      ))}
    </>
  )
}
