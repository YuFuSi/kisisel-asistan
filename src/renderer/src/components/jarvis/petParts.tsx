import { motion, type TargetAndTransition } from 'motion/react'
import { Heart, type LucideIcon } from 'lucide-react'
import type { HandGesture } from '../../lib/petLook'

// Pet'in yardımcı parçaları: ekran simgeleri, anten rengi ve yüzen eller (prototip "Jarvis Cam")

/** Ekranın alt kısmında beliren araç simgesi */
export function ScreenIcon({
  icon: Icon,
  size,
  still = false
}: {
  icon: LucideIcon
  size: number
  /** Hareket azaltma: nabız atmaz */
  still?: boolean
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
      animate={{ opacity: 1, scale: still ? 1 : [1, 1.08, 1], y: 0 }}
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

/** Konuşurken gözlerin altında açılıp kapanan ışıktan ağız */
export function SpeakingMouth({
  size,
  still = false
}: {
  size: number
  /** Hareket azaltma: ağız açık durur, oynamaz */
  still?: boolean
}): React.JSX.Element {
  const h = size * 0.06
  return (
    <motion.span
      className="absolute left-1/2 block bg-[#c9d0ff]"
      style={{
        bottom: size * 0.07,
        width: size * 0.13,
        marginLeft: -size * 0.065,
        height: h,
        borderRadius: h,
        boxShadow: '0 0 10px rgb(190 200 255 / 0.9)'
      }}
      initial={{ scaleY: 0.2, opacity: 0 }}
      animate={
        still
          ? { opacity: 1, scaleY: 0.6, scaleX: 1 }
          : {
              opacity: 1,
              scaleY: [0.25, 1, 0.45, 0.85, 0.2, 0.7, 0.35, 1, 0.25],
              scaleX: [1, 0.8, 1, 0.85, 1.05, 0.9, 1, 0.8, 1]
            }
      }
      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/** Ekranda gizlice oynanan minik yılan oyunu */
export function SnakeGame({ size }: { size: number }): React.JSX.Element {
  const cell = size * 0.035
  // Yılanın ekranda dolaştığı dikdörtgen yol
  const xs = [-0.18, 0.18, 0.18, -0.18, -0.18].map((v) => v * size)
  const ys = [-0.07, -0.07, 0.07, 0.07, -0.07].map((v) => v * size)
  return (
    <motion.span
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
    >
      {/* Elma */}
      <motion.span
        className="absolute block rounded-full bg-[#ff7d9c]"
        style={{ width: cell, height: cell, boxShadow: '0 0 6px #ff7d9c' }}
        animate={{
          x: [0.1, 0.1, -0.12, -0.12, 0.05, 0.05].map((v) => v * size),
          y: [0.04, 0.04, -0.05, -0.05, 0, 0].map((v) => v * size)
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.33, 0.34, 0.66, 0.67, 1]
        }}
      />
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="absolute block rounded-[2px] bg-[#7ef0b5]"
          style={{
            width: cell,
            height: cell,
            opacity: 1 - i * 0.18,
            boxShadow: '0 0 6px rgb(126 240 181 / 0.8)'
          }}
          animate={{ x: xs, y: ys }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: -i * 0.09 }}
        />
      ))}
    </motion.span>
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
            // El kalkar, sallar ve yumuşakça geri iner
            x: [0, -w * 0.02, -w * 0.02, -w * 0.02, -w * 0.02, -w * 0.02, -w * 0.02, 0],
            y: [0, -h * 0.62, -h * 0.62, -h * 0.62, -h * 0.62, -h * 0.62, -h * 0.62, 0],
            rotate: [0, 32, -16, 32, -16, 32, -16, 0],
            transition: { duration: 1.3, ease: 'easeInOut' }
          }
        : { x: 0, y: [0, -4, 0], rotate: 0, transition: { duration: 2.2, repeat: Infinity } }
    case 'happy':
      return {
        x: -dir * w * 0.04,
        y: [-h * 0.55, -h * 0.68, -h * 0.55],
        rotate: [dir * 10, -dir * 10, dir * 10],
        transition: { duration: 0.3, repeat: 4 }
      }
    case 'think':
      return right
        ? {
            x: -w * 0.4,
            y: [h * 0.22, h * 0.19, h * 0.22],
            rotate: -20,
            transition: {
              y: { duration: 0.55, repeat: Infinity },
              default: { type: 'spring', stiffness: 260, damping: 18 }
            }
          }
        : { x: 0, y: [0, -3, 0], rotate: 0, transition: { duration: 2.2, repeat: Infinity } }
    case 'listen':
      return {
        x: -dir * w * 0.06,
        y: -h * 0.18,
        rotate: dir * 15,
        transition: { type: 'spring', stiffness: 280, damping: 16 }
      }
    case 'work':
      return {
        x: -dir * w * 0.1,
        y: right ? [h * 0.05, -h * 0.02, h * 0.05] : [-h * 0.02, h * 0.05, -h * 0.02],
        rotate: 0,
        transition: { duration: 0.22, repeat: Infinity }
      }
    case 'speak':
      return right
        ? {
            x: w * 0.02,
            y: [-h * 0.12, -h * 0.2, -h * 0.12],
            rotate: [0, 14, 0],
            transition: { duration: 0.75, repeat: Infinity }
          }
        : { x: 0, y: [0, -4, 0], rotate: 0, transition: { duration: 2.2, repeat: Infinity } }
    case 'approval':
      return right
        ? {
            x: -w * 0.04,
            y: -h * 0.5,
            rotate: -8,
            transition: { type: 'spring', stiffness: 320, damping: 14 }
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
    case 'dance':
      return {
        x: [0, -dir * w * 0.03, 0, -dir * w * 0.03, 0],
        y: right ? [0, -h * 0.4, 0, -h * 0.4, 0] : [0, h * 0.05, -h * 0.4, h * 0.05, 0],
        rotate: [0, dir * 20, -dir * 10, dir * 20, 0],
        transition: { duration: 1.6, ease: 'easeInOut' }
      }
    case 'stretch':
      return {
        x: [0, -dir * w * 0.06, -dir * w * 0.06, 0],
        y: [0, -h * 0.72, -h * 0.72, 0],
        rotate: [0, -dir * 8, -dir * 8, 0],
        transition: { duration: 1.4, times: [0, 0.3, 0.75, 1] }
      }
    case 'tickle':
      // Karnını tutup gülüyor
      return {
        x: -dir * w * 0.14,
        y: [h * 0.12, h * 0.06, h * 0.12],
        rotate: [dir * 10, -dir * 10, dir * 10],
        transition: { duration: 0.2, repeat: Infinity }
      }
    case 'dizzy':
      return {
        x: [0, dir * w * 0.04, 0],
        y: [-h * 0.05, h * 0.08, -h * 0.05],
        rotate: [dir * 30, -dir * 10, dir * 30],
        transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
      }
    case 'angry':
      // Yumruklar havada titriyor
      return {
        x: -dir * w * 0.02,
        y: [-h * 0.3, -h * 0.36, -h * 0.3],
        rotate: [dir * 12, -dir * 6, dir * 12],
        transition: { duration: 0.14, repeat: Infinity }
      }
    case 'sulk':
      // Kollarını kavuşturmuş, küs
      return {
        x: -dir * w * 0.2,
        y: h * 0.06,
        rotate: dir * 40,
        transition: { type: 'spring', stiffness: 200, damping: 16 }
      }
    case 'shy':
      // Elleri yanaklarında, utanıp kıpırdanıyor
      return {
        x: -dir * w * 0.17,
        y: [-h * 0.12, -h * 0.08, -h * 0.12],
        rotate: -dir * 20,
        transition: {
          y: { duration: 0.5, repeat: Infinity },
          default: { type: 'spring', stiffness: 260, damping: 16 }
        }
      }
    case 'game':
      // Oyun kolu tutuyor gibi, parmaklar hızlı hızlı
      return {
        x: -dir * w * 0.12,
        y: [h * 0.02, -h * 0.03, h * 0.02],
        rotate: dir * -10,
        transition: { duration: right ? 0.18 : 0.24, repeat: Infinity }
      }
    case 'bored':
      // Sağ el sabırsızca tıkırdatıyor, sol el sarkık
      return right
        ? {
            x: -w * 0.05,
            y: [h * 0.12, h * 0.06, h * 0.12],
            rotate: 0,
            transition: { duration: 0.28, repeat: Infinity }
          }
        : {
            x: 0,
            y: h * 0.14,
            rotate: 15,
            transition: { type: 'spring', stiffness: 90, damping: 14 }
          }
    default:
      return {
        x: 0,
        y: [0, -5, 0],
        rotate: 0,
        transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: right ? 0.4 : 0 }
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
  /** Sağ ele takılı aksesuar (kıyafet dolabı) */
  rightItem?: React.ReactNode
}

/** Gövdenin iki yanında süzülen cam eller */
export function Hands({
  gesture,
  width,
  height,
  gestureKey,
  rightItem
}: HandsProps): React.JSX.Element {
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
        >
          {right && rightItem}
        </motion.span>
      ))}
    </>
  )
}
