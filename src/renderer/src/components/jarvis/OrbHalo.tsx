import { motion, useReducedMotion } from 'motion/react'
import type { AssistantState } from '../../lib/assistantState'

interface OrbHaloProps {
  state: AssistantState
  /** Halkanın çapı (px); küre tuvalinin kenarına yakın verilir */
  size: number
}

// Durum başına halkanın görünümü: parlaklık, ölçek ve dönüş hızı (sn/tur; 0 = durgun)
const LOOK: Record<AssistantState, { opacity: number; scale: number; spin: number; hue: number }> =
  {
    idle: { opacity: 0.5, scale: 0.96, spin: 0, hue: 0 },
    listening: { opacity: 0.95, scale: 1.06, spin: 0, hue: -14 },
    thinking: { opacity: 0.8, scale: 1, spin: 9, hue: 10 },
    working: { opacity: 0.9, scale: 1.02, spin: 5, hue: 18 },
    speaking: { opacity: 0.9, scale: 1.04, spin: 14, hue: -6 },
    approval: { opacity: 0.85, scale: 1, spin: 0, hue: 150 }
  }

// Kürenin arkasında parlayan ışık halkası (Jarvis Cam): bulanık, renkli bir halka; durum
// değişince yumuşakça büyür, parlar ya da yavaşça döner. Sadece CSS dönüşümü ve opaklık değişir.
function OrbHalo({ state, size }: OrbHaloProps): React.JSX.Element {
  const reduced = useReducedMotion()
  const look = LOOK[state]
  const ring = `conic-gradient(from 0deg, hsl(${232 + look.hue} 95% 70%), hsl(${200 + look.hue} 95% 65%), hsl(${275 + look.hue} 90% 72%), hsl(${232 + look.hue} 95% 70%))`
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      animate={{ opacity: look.opacity, scale: reduced ? 1 : look.scale }}
      transition={{ type: 'spring', stiffness: 80, damping: 18, mass: 1 }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: ring,
          // Halka: ortası boş, kenarı yumuşak bir ışık bandı
          mask: 'radial-gradient(circle, transparent 58%, #000 63%, #000 65%, transparent 71%)',
          filter: 'blur(18px)'
        }}
        animate={reduced || look.spin === 0 ? { rotate: 0 } : { rotate: 360 }}
        transition={
          reduced || look.spin === 0
            ? { duration: 1.2, ease: [0.22, 1, 0.36, 1] }
            : { duration: look.spin, ease: 'linear', repeat: Infinity }
        }
      />
      {/* Halkanın içine sızan yumuşak ışık */}
      <div
        className="absolute inset-[18%] rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(${232 + look.hue} 90% 70% / 0.18), transparent 70%)`
        }}
      />
    </motion.div>
  )
}

export default OrbHalo
