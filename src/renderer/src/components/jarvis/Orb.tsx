import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { getAudioLevel } from '../../lib/audioLevel'
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
const HUE_DRIFT = 34
const PULSE_SECONDS = 5
const SURFACE_DOTS = 460
const HALO_DOTS = 70

interface Params {
  ring: number
  arcs: number
  ripple: number
}

// Durum başına hedefler: halka, dönen yay ve konuşma dalgası görünürlüğü (0-1)
const TARGETS: Record<AssistantState, Params> = {
  idle: { ring: 0, arcs: 0, ripple: 0 },
  listening: { ring: 1, arcs: 0, ripple: 0 },
  thinking: { ring: 0, arcs: 1, ripple: 0 },
  working: { ring: 0, arcs: 2, ripple: 0 },
  speaking: { ring: 0, arcs: 0, ripple: 1 }
}

// İç ışık lekeleri: konum yolu (hız, faz), boyut ve renk kayması; biri camgöbeği-mor tarafa kayar
const BLOBS = [
  { speedX: 0.42, speedY: 0.55, phase: 0, size: 0.75, lightness: 84, alpha: 0.6, hue: -8 },
  { speedX: 0.63, speedY: 0.34, phase: 2.1, size: 0.65, lightness: 62, alpha: 0.55, hue: 42 },
  { speedX: 0.31, speedY: 0.5, phase: 4.2, size: 0.7, lightness: 56, alpha: 0.5, hue: -40 },
  { speedX: 0.52, speedY: 0.27, phase: 5.4, size: 0.5, lightness: 78, alpha: 0.42, hue: 70 },
  { speedX: 0.24, speedY: 0.61, phase: 1.1, size: 0.55, lightness: 70, alpha: 0.4, hue: -70 }
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

// Jarvis küresi: tek gövdeli, sakin; iç ışık, yüzey parçacıkları ve duruma göre halka/yay/dalga ekleyen canvas çizimi
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

    const params: Params = { ...TARGETS[stateRef.current] }
    let level = 0
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
      params.ring += (target.ring - params.ring) * ease
      params.arcs += (target.arcs - params.arcs) * ease
      params.ripple += (target.ripple - params.ripple) * ease

      const rawLevel =
        current === 'listening'
          ? getAudioLevel('input')
          : current === 'speaking'
            ? getAudioLevel('output')
            : 0
      const energyTarget = Math.max(rawLevel, exciteRef.current)
      level += (energyTarget - level) * (reduced ? 1 : Math.min(dt * 12, 1))
      if (!reduced) spin += dt * (current === 'working' ? 1.6 : 0.8)

      const t = reduced ? 0 : now / 1000
      // Renk sürekli yavaşça kayar: birkaç yavaş dalganın toplamı, taban vurgu tonu etrafında
      const drift = reduced
        ? 0
        : Math.sin(t * 0.21) * HUE_DRIFT + Math.sin(t * 0.13 + 1.3) * HUE_DRIFT * 0.5
      const tone = (lightness: number, alpha = 1, hueOffset = 0): string =>
        orbHsla(current, lightness, alpha, hueOffset + drift)
      const breath = 1 + Math.sin((t * Math.PI * 2) / BREATH_SECONDS) * BREATH_AMOUNT
      const r = radius * breath * (1 + level * 0.12 * params.ripple + level * 0.05 * params.ring)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      if (!small) {
        // Yere düşen yumuşak ışıma: küre havada asılı gibi dursun
        ctx.save()
        ctx.translate(cx, cy + r * 1.55)
        ctx.scale(1, 0.18)
        const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1)
        floor.addColorStop(0, tone(70, 0.28))
        floor.addColorStop(1, tone(70, 0))
        ctx.fillStyle = floor
        ctx.beginPath()
        ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Çok hafif dış ışıma; tuval kenarında kesilmesin diye yarıçap sınırlı
      const glowRadius = Math.min(r * (small ? 1.5 : 2), size / 2)
      const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, glowRadius)
      glow.addColorStop(0, tone(70, 0.22 + level * 0.12))
      glow.addColorStop(1, tone(70, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Gövde: üstten aydınlık, kenarda koyu degrade
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
      body.addColorStop(0, tone(88, 1, -4))
      body.addColorStop(0.55, tone(68, 1))
      body.addColorStop(1, tone(40, 1, 10))
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      if (!small) {
        // İç doku: küreyle kırpılmış, yavaş süzülen yumuşak ışık lekeleri
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.clip()
        const flow = t * (1 + level * 2.5)
        for (const blob of BLOBS) {
          const bx = cx + Math.sin(flow * blob.speedX + blob.phase) * r * 0.5
          const by = cy + Math.cos(flow * blob.speedY + blob.phase * 1.7) * r * 0.5
          const br = r * blob.size
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
          g.addColorStop(0, tone(blob.lightness, blob.alpha, blob.hue))
          g.addColorStop(1, tone(blob.lightness, 0, blob.hue))
          ctx.fillStyle = g
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        }
        ctx.restore()

        // Yüzey parçacıkları: çok yavaş kayan, hafif parıldayan iridesan noktalar
        const yaw = t * 0.09
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        for (const dot of surface) {
          const x = dot.x * cosY - dot.z * sinY
          const z = dot.x * sinY + dot.z * cosY
          if (z < -0.15) continue
          const depth = (z + 1) / 2
          const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + dot.seed * 40)
          const px = cx + x * r * 0.98
          const py = cy + dot.y * r * 0.98
          ctx.fillStyle = orbHsla(
            current,
            80,
            (0.12 + depth * 0.4 + twinkle * 0.25) * (0.8 + level * 0.5),
            dot.seed * 60
          )
          ctx.beginPath()
          ctx.arc(px, py, 0.6 + depth * 0.9 + level * 0.5, 0, Math.PI * 2)
          ctx.fill()
        }

        // Üstte cam yansıması
        const gloss = ctx.createRadialGradient(
          cx - r * 0.35,
          cy - r * 0.55,
          0,
          cx - r * 0.35,
          cy - r * 0.55,
          r * 0.55
        )
        gloss.addColorStop(0, 'rgba(255,255,255,0.26)')
        gloss.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gloss
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()

        // Kenarda ince ışık çizgisi
        ctx.lineWidth = 1
        ctx.strokeStyle = tone(85, 0.35)
        ctx.beginPath()
        ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2)
        ctx.stroke()

        // Halo: kürenin çevresinde yavaşça yükselip sönen toz parçacıkları
        for (const dot of halo) {
          const life = fract(dot.seed * 7 + t * 0.035)
          const dist = r * (1.12 + life * 0.55)
          const px = cx + dot.x * dist
          const py = cy + dot.y * dist * 0.92
          const alpha = Math.sin(life * Math.PI) * (0.3 + level * 0.3)
          ctx.fillStyle = tone(82, alpha, dot.seed * 50)
          ctx.beginPath()
          ctx.arc(px, py, 0.7 + life * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Beklemede: kürenin içinden dışa yumuşakça yayılan dalgalar
      if (!small && !reduced && params.ring + params.arcs + params.ripple < 0.5) {
        for (let i = 0; i < 2; i++) {
          const phase = fract(t / PULSE_SECONDS + i * 0.5)
          ctx.lineWidth = 1.5
          ctx.strokeStyle = tone(80, Math.pow(1 - phase, 2) * 0.32, i * 24)
          ctx.beginPath()
          ctx.arc(cx, cy, r * (1.02 + phase * 0.55), 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Dinlerken: ses seviyesiyle genişleyen ince halka
      if (params.ring > 0.01) {
        const ringRadius = r * (1.25 + level * 0.3)
        ctx.lineWidth = small ? 1.5 : 2
        ctx.strokeStyle = tone(78, 0.7 * params.ring)
        ctx.beginPath()
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Düşünürken bir, çalışırken iki dönen yay
      if (params.arcs > 0.01) {
        ctx.lineWidth = small ? 1.5 : 2
        ctx.lineCap = 'round'
        const count = params.arcs > 1.5 ? 2 : 1
        const alpha = Math.min(params.arcs, 1) * 0.8
        for (let i = 0; i < count; i++) {
          const start = spin + (i * Math.PI * 2) / count
          ctx.strokeStyle = tone(78, alpha)
          ctx.beginPath()
          ctx.arc(cx, cy, r * 1.32, start, start + 1.1)
          ctx.stroke()
        }
      }

      // Konuşurken: kürenin içinden dışa yayılan yumuşak dalga
      if (params.ripple > 0.01) {
        const phase = (t * 0.9) % 1
        const rippleRadius = r * (1.05 + phase * 0.5 + level * 0.15)
        ctx.lineWidth = 2
        ctx.strokeStyle = tone(78, (1 - phase) * 0.6 * params.ripple)
        ctx.beginPath()
        ctx.arc(cx, cy, rippleRadius, 0, Math.PI * 2)
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
