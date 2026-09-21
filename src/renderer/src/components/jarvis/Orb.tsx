import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { BAND_COUNT, getAudioLevel, getAudioSpectrum } from '../../lib/audioLevel'
import { orbHsla } from '../../lib/orbColor'

interface OrbProps {
  state: AssistantState
  /** Tuvalin kenarı (px); küre bunun yaklaşık %30'u kadardır, halkalara ve ışımaya yer kalır */
  size?: number
  /** 0-1: yazı yazılırken gibi anlık heyecan; ses seviyesi gibi iç ışığı ve parçacıkları canlandırır */
  excite?: number
}

// Hızlı ince ayar için tüm sayılar burada
const SPHERE_RATIO = 0.3
const BREATH_SECONDS = 5
const BREATH_AMOUNT = 0.02
const EASE_PER_SECOND = 3
const SMALL_SIZE = 120
const HUE_DRIFT = 10
const PULSE_SECONDS = 5
const SURFACE_DOTS = 620
const HALO_DOTS = 70
const TAU = Math.PI * 2

interface Params {
  /** Dinlerken ses çubuğu halkası */
  listen: number
  arcs: number
  /** Konuşurken ses çubuğu halkası ve dalga */
  speak: number
}

// Durum başına hedefler (0-1; arcs 0-2)
const TARGETS: Record<AssistantState, Params> = {
  idle: { listen: 0, arcs: 0, speak: 0 },
  listening: { listen: 1, arcs: 0, speak: 0 },
  thinking: { listen: 0, arcs: 1, speak: 0 },
  working: { listen: 0, arcs: 2, speak: 0 },
  speaking: { listen: 0, arcs: 0, speak: 1 }
}

// İç sis: kürenin içinde süzülen soluk ışık bulutları; renk kaymaları küçük tutulur (gökkuşağı olmasın)
const BLOBS = [
  { speedX: 0.42, speedY: 0.55, phase: 0, size: 0.75, lightness: 78, alpha: 0.3, hue: -6 },
  { speedX: 0.63, speedY: 0.34, phase: 2.1, size: 0.65, lightness: 62, alpha: 0.26, hue: 12 },
  { speedX: 0.31, speedY: 0.5, phase: 4.2, size: 0.7, lightness: 58, alpha: 0.24, hue: -12 },
  { speedX: 0.52, speedY: 0.27, phase: 5.4, size: 0.5, lightness: 74, alpha: 0.2, hue: 18 }
]

interface Dot {
  x: number
  y: number
  z: number
  seed: number
}

// Küre yüzeyine eşit dağılmış noktalar (fibonacci küresi); halo noktaları ise rastgele yönlü
function buildDots(count: number, halo: boolean): Dot[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / Math.max(1, count - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i * (halo ? 1.37 : 1)
    return {
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      seed: (Math.sin(i * 91.7) * 43758.5453) % 1
    }
  })
}

const fract = (value: number): number => value - Math.floor(value)

// Jarvis küresi: cam gibi yarı saydam gövde, iç sis, yüzey parçacıkları; dinlerken ve konuşurken
// çevresinde ses çubuğu halkası, düşünürken dönen yaylar
function Orb({ state, size = 240, excite = 0 }: OrbProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const exciteRef = useRef(excite)

  useEffect(() => {
    stateRef.current = state
    exciteRef.current = excite
  }, [state, excite])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = size < SMALL_SIZE
    const radius = size * SPHERE_RATIO
    const cx = size / 2
    const cy = size / 2
    const surface = small ? [] : buildDots(SURFACE_DOTS, false)
    const halo = small ? [] : buildDots(HALO_DOTS, true)
    // Ses çubuklarının yumuşatılmış değerleri (aynalı: BAND_COUNT * 2 çubuk)
    const bars = new Array<number>(BAND_COUNT * 2).fill(0)

    const params: Params = { ...TARGETS[stateRef.current] }
    let level = 0
    // İç ışık ve parlaklık için çok yavaş yumuşatılmış ses enerjisi (göz yormasın diye ayrı tutulur)
    let energy = 0
    let flow = 0
    let spin = 0
    let last = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const draw = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const current = stateRef.current
      const target = TARGETS[current]
      const ease = reduced ? 1 : Math.min(dt * EASE_PER_SECOND, 1)
      params.listen += (target.listen - params.listen) * ease
      params.arcs += (target.arcs - params.arcs) * ease
      params.speak += (target.speak - params.speak) * ease

      const rawLevel =
        current === 'listening'
          ? getAudioLevel('input')
          : current === 'speaking'
            ? getAudioLevel('output')
            : 0
      const energyTarget = Math.max(rawLevel, exciteRef.current)
      level += (energyTarget - level) * (reduced ? 1 : Math.min(dt * 12, 1))
      energy += (energyTarget - energy) * (reduced ? 1 : Math.min(dt * 1.6, 1))
      if (!reduced) flow += dt * (1 + energy * 0.9)
      if (!reduced) spin += dt * (current === 'working' ? 1.6 : 0.8)

      const t = reduced ? 0 : now / 1000
      // Renk çok az kayar: taban vurgu tonu etrafında küçük bir salınım
      const drift = reduced
        ? 0
        : Math.sin(t * 0.21) * HUE_DRIFT + Math.sin(t * 0.13 + 1.3) * HUE_DRIFT * 0.5
      const tone = (lightness: number, alpha = 1, hueOffset = 0): string =>
        orbHsla(current, lightness, alpha, hueOffset + drift)
      const breath = 1 + Math.sin((t * TAU) / BREATH_SECONDS) * BREATH_AMOUNT
      const r = radius * breath * (1 + energy * 0.08 * params.speak + energy * 0.03 * params.listen)
      const voice = Math.max(params.listen, params.speak)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      if (!small) {
        // Yere düşen yumuşak ışıma: küre havada asılı gibi dursun
        ctx.save()
        ctx.translate(cx, cy + r * 1.55)
        ctx.scale(1, 0.18)
        const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1)
        floor.addColorStop(0, tone(70, 0.22))
        floor.addColorStop(1, tone(70, 0))
        ctx.fillStyle = floor
        ctx.beginPath()
        ctx.arc(0, 0, r * 1.1, 0, TAU)
        ctx.fill()
        ctx.restore()
      }

      // Çok hafif dış ışıma; tuval kenarında kesilmesin diye yarıçap sınırlı
      const glowRadius = Math.min(r * (small ? 1.5 : 2), size / 2)
      const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, glowRadius)
      glow.addColorStop(0, tone(70, 0.16 + energy * 0.06))
      glow.addColorStop(1, tone(70, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, glowRadius, 0, TAU)
      ctx.fill()

      // Gövde: koyu bir taban üstünde yarı saydam cam; dolgun değil, kenara doğru yoğunlaşır
      ctx.fillStyle = 'rgba(9, 10, 14, 0.92)'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()
      const glass = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r)
      glass.addColorStop(0, tone(76, 0.12))
      glass.addColorStop(0.6, tone(62, 0.16))
      glass.addColorStop(0.88, tone(56, 0.34))
      glass.addColorStop(1, tone(66, 0.6))
      ctx.fillStyle = glass
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()

      if (!small) {
        // İç sis: küreyle kırpılmış, yavaş süzülen soluk ışık bulutları
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.clip()
        for (const blob of BLOBS) {
          const bx = cx + Math.sin(flow * blob.speedX + blob.phase) * r * 0.5
          const by = cy + Math.cos(flow * blob.speedY + blob.phase * 1.7) * r * 0.5
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * blob.size)
          g.addColorStop(0, tone(blob.lightness, blob.alpha * (1 + energy * 0.3), blob.hue))
          g.addColorStop(1, tone(blob.lightness, 0, blob.hue))
          ctx.fillStyle = g
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        }
        ctx.restore()

        // Yüzey parçacıkları: küreyi tanımlayan, hafif parıldayan noktalar
        const yaw = t * 0.09
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        for (const dot of surface) {
          const x = dot.x * cosY - dot.z * sinY
          const z = dot.x * sinY + dot.z * cosY
          if (z < -0.15) continue
          const depth = (z + 1) / 2
          const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + dot.seed * 40)
          ctx.fillStyle = tone(
            84,
            (0.16 + depth * 0.5 + twinkle * 0.3) * (0.9 + energy * 0.2),
            dot.seed * 16
          )
          ctx.beginPath()
          ctx.arc(cx + x * r * 0.98, cy + dot.y * r * 0.98, 0.7 + depth * 1 + energy * 0.25, 0, TAU)
          ctx.fill()
        }

        // Cam yansıması: yumuşak, üst sol köşede
        const gloss = ctx.createRadialGradient(
          cx - r * 0.35,
          cy - r * 0.55,
          0,
          cx - r * 0.35,
          cy - r * 0.55,
          r * 0.5
        )
        gloss.addColorStop(0, 'rgba(255,255,255,0.16)')
        gloss.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gloss
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.fill()
      }

      // Kenar ışığı: kürenin cam gibi görünmesini sağlayan ince parlak çizgi
      ctx.lineWidth = small ? 1 : 1.6
      ctx.strokeStyle = tone(82, 0.55)
      ctx.beginPath()
      ctx.arc(cx, cy, r - 0.8, 0, TAU)
      ctx.stroke()

      if (!small) {
        // Halo: kürenin çevresinde yavaşça yükselip sönen toz parçacıkları
        for (const dot of halo) {
          const life = fract(dot.seed * 7 + t * 0.035)
          const dist = r * (1.12 + life * 0.55)
          const alpha = Math.sin(life * Math.PI) * (0.3 + energy * 0.1)
          ctx.fillStyle = tone(82, alpha, dot.seed * 14)
          ctx.beginPath()
          ctx.arc(cx + dot.x * dist, cy + dot.y * dist * 0.92, 0.7 + life * 0.6, 0, TAU)
          ctx.fill()
        }
      }

      // Beklemede: kürenin içinden dışa yumuşakça yayılan dalgalar
      if (!small && !reduced && params.listen + params.arcs + params.speak < 0.5) {
        for (let i = 0; i < 2; i++) {
          const phase = fract(t / PULSE_SECONDS + i * 0.5)
          ctx.lineWidth = 1.5
          ctx.strokeStyle = tone(80, Math.pow(1 - phase, 2) * 0.3, i * 10)
          ctx.beginPath()
          ctx.arc(cx, cy, r * (1.02 + phase * 0.55), 0, TAU)
          ctx.stroke()
        }
      }

      // Dinlerken ve konuşurken: kürenin çevresinde ses çubuğu halkası.
      // Dinlerken gerçek mikrofon bantları, konuşurken cevabın ses bantları (yoksa yapay dalga) çizilir.
      if (voice > 0.01 && !small) {
        const source = current === 'speaking' ? 'output' : 'input'
        const spectrum = getAudioSpectrum(source, BAND_COUNT)
        const total = spectrum.reduce((sum, v) => sum + v, 0)
        const count = bars.length
        for (let i = 0; i < count; i++) {
          const band = i < BAND_COUNT ? i : count - 1 - i
          const real = Math.min(1, spectrum[band] * 2.6)
          const synthetic =
            0.22 + 0.26 * Math.sin(t * 5 + i * 0.55) * Math.sin(t * 2.3 + i * 0.21 + 1)
          // Ses geliyorsa gerçek bant, konuşurken ses analizi yoksa yapay dalga
          const value =
            total > 0.02 ? real : current === 'speaking' ? Math.max(0.05, synthetic) : 0.05
          bars[i] += (value - bars[i]) * (reduced ? 1 : Math.min(dt * 16, 1))
          const angle = (i / count) * TAU - Math.PI / 2
          const inner = r * 1.16
          const outer = inner + 3 + bars[i] * r * (current === 'speaking' ? 0.5 : 0.36)
          ctx.lineWidth = current === 'speaking' ? 3 : 2
          ctx.lineCap = 'round'
          ctx.strokeStyle = tone(78, (0.35 + bars[i] * 0.6) * voice)
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
          ctx.stroke()
        }
      }

      // Düşünürken bir, çalışırken iki dönen yay
      if (params.arcs > 0.01) {
        ctx.lineWidth = small ? 1.5 : 2
        ctx.lineCap = 'round'
        const count = params.arcs > 1.5 ? 2 : 1
        const alpha = Math.min(params.arcs, 1) * 0.8
        for (let i = 0; i < count; i++) {
          const start = spin + (i * TAU) / count
          ctx.strokeStyle = tone(78, alpha)
          ctx.beginPath()
          ctx.arc(cx, cy, r * 1.32, start, start + 1.1)
          ctx.stroke()
        }
      }

      // Konuşurken: kürenin içinden dışa yayılan yumuşak dalga
      if (params.speak > 0.01) {
        const phase = (t * 0.9) % 1
        ctx.lineWidth = 2
        ctx.strokeStyle = tone(78, (1 - phase) * 0.5 * params.speak)
        ctx.beginPath()
        ctx.arc(cx, cy, r * (1.02 + phase * 0.14 + energy * 0.03), 0, TAU)
        ctx.stroke()
      }

      if (reduced) timer = setTimeout(() => (frame = requestAnimationFrame(draw)), 500)
      else frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Jarvis: ${STATE_LABELS[state]}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
    />
  )
}

export default Orb
