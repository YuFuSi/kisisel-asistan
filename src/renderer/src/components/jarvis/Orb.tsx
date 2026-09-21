import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { getAudioLevel } from '../../lib/audioLevel'
import { orbHsla } from '../../lib/orbColor'

interface OrbProps {
  state: AssistantState
  /** Tuvalin kenarı (px); küre bunun yaklaşık yarısı kadardır, halkalara yer kalır */
  size?: number
}

// Hızlı ince ayar için tüm sayılar burada
const SPHERE_RATIO = 0.27
const BREATH_SECONDS = 5
const BREATH_AMOUNT = 0.02
const EASE_PER_SECOND = 3
const SMALL_SIZE = 120

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
  { speedX: 0.23, speedY: 0.31, phase: 0, size: 0.75, lightness: 82, alpha: 0.55, hue: -6 },
  { speedX: 0.37, speedY: 0.19, phase: 2.1, size: 0.65, lightness: 60, alpha: 0.5, hue: 36 },
  { speedX: 0.17, speedY: 0.29, phase: 4.2, size: 0.7, lightness: 55, alpha: 0.45, hue: -34 }
]

// Jarvis küresi: tek gövdeli, sakin, duruma göre halka/yay/dalga ekleyen canvas çizimi
function Orb({ state, size = 240 }: OrbProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

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
      level += (rawLevel - level) * (reduced ? 1 : Math.min(dt * 12, 1))
      if (!reduced) spin += dt * (current === 'working' ? 1.6 : 0.8)

      const t = reduced ? 0 : now / 1000
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
        floor.addColorStop(0, orbHsla(current, 70, 0.28))
        floor.addColorStop(1, orbHsla(current, 70, 0))
        ctx.fillStyle = floor
        ctx.beginPath()
        ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Çok hafif dış ışıma
      const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * (small ? 1.5 : 2))
      glow.addColorStop(0, orbHsla(current, 70, 0.22))
      glow.addColorStop(1, orbHsla(current, 70, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, r * (small ? 1.5 : 2), 0, Math.PI * 2)
      ctx.fill()

      // Gövde: üstten aydınlık, kenarda koyu degrade
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
      body.addColorStop(0, orbHsla(current, 88, 1, -4))
      body.addColorStop(0.55, orbHsla(current, 68, 1))
      body.addColorStop(1, orbHsla(current, 40, 1, 10))
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
        const drift = t * (1 + level * 2)
        for (const blob of BLOBS) {
          const bx = cx + Math.sin(drift * blob.speedX + blob.phase) * r * 0.42
          const by = cy + Math.cos(drift * blob.speedY + blob.phase * 1.7) * r * 0.42
          const br = r * blob.size
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
          g.addColorStop(0, orbHsla(current, blob.lightness, blob.alpha, blob.hue))
          g.addColorStop(1, orbHsla(current, blob.lightness, 0, blob.hue))
          ctx.fillStyle = g
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        }
        ctx.restore()

        // Üstte cam yansıması
        const gloss = ctx.createRadialGradient(
          cx - r * 0.35,
          cy - r * 0.55,
          0,
          cx - r * 0.35,
          cy - r * 0.55,
          r * 0.55
        )
        gloss.addColorStop(0, 'rgba(255,255,255,0.28)')
        gloss.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gloss
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()

        // Kenarda ince ışık çizgisi
        ctx.lineWidth = 1
        ctx.strokeStyle = orbHsla(current, 85, 0.35)
        ctx.beginPath()
        ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Dinlerken: ses seviyesiyle genişleyen ince halka
      if (params.ring > 0.01) {
        const ringRadius = r * (1.28 + level * 0.45)
        ctx.lineWidth = small ? 1.5 : 2
        ctx.strokeStyle = orbHsla(current, 78, 0.7 * params.ring)
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
          ctx.strokeStyle = orbHsla(current, 78, alpha)
          ctx.beginPath()
          ctx.arc(cx, cy, r * 1.32, start, start + 1.1)
          ctx.stroke()
        }
      }

      // Konuşurken: kürenin içinden dışa yayılan yumuşak dalga
      if (params.ripple > 0.01) {
        const phase = (t * 0.9) % 1
        const rippleRadius = r * (1.05 + phase * 0.6 + level * 0.2)
        ctx.lineWidth = 2
        ctx.strokeStyle = orbHsla(current, 78, (1 - phase) * 0.6 * params.ripple)
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
