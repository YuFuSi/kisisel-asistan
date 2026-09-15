import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { getAudioLevel } from '../../lib/audioLevel'

interface OrbProps {
  state: AssistantState
  /** Kürenin yaklaşık çapı (px); tuval, alttaki ışık çizgisi için daha geniştir */
  size?: number
}

interface Motion {
  /** Dönme ve dalgalanma hızı */
  speed: number
  /** Işık yoğunluğu */
  intensity: number
  /** Halka ve ortadaki dalganın genliği */
  wave: number
}

const TARGETS: Record<AssistantState, Motion> = {
  idle: { speed: 0.35, intensity: 0.6, wave: 0.25 },
  listening: { speed: 0.7, intensity: 0.9, wave: 0.45 },
  thinking: { speed: 1.5, intensity: 0.85, wave: 0.35 },
  working: { speed: 1.1, intensity: 0.95, wave: 0.5 },
  speaking: { speed: 0.9, intensity: 1, wave: 0.75 }
}

const WIDTH_RATIO = 1.9
const HEIGHT_RATIO = 1.15
const SPARK_COUNT = 28

/** Tema rengini (ör. --color-accent) CSS değişkeninden okur */
function themeColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Jarvis küresi: durumuna göre hızlanan, parlayan ve dalgalanan halka (canvas ile çizilir)
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

    const width = size * WIDTH_RATIO
    const height = size * HEIGHT_RATIO
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const accent = themeColor('--color-accent', '#2f7dff')
    const glow = themeColor('--color-glow', '#3cc4ff')
    const white = '#e8f7ff'
    // Hareketi azalt tercihi açıksa küre yavaş yenilenen, dönmeyen bir görüntü olur
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const motion: Motion = { ...TARGETS[stateRef.current] }
    const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => ({
      angle: (i / SPARK_COUNT) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.4,
      seed: ((i * 37) % 11) / 11,
      direction: i % 2 === 0 ? 1 : -1
    }))

    let phase = 0
    let last = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const draw = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const target = TARGETS[stateRef.current]
      const ease = reduced ? 1 : Math.min(dt * 3, 1)
      motion.speed += (target.speed - motion.speed) * ease
      motion.intensity += (target.intensity - motion.intensity) * ease
      motion.wave += (target.wave - motion.wave) * ease
      phase += dt * motion.speed

      const t = reduced ? 0 : phase
      // Dinlerken mikrofonun, konuşurken Jarvis'in sesinin seviyesi
      const level =
        stateRef.current === 'listening'
          ? getAudioLevel('input')
          : stateRef.current === 'speaking'
            ? getAudioLevel('output') * 0.6
            : 0
      const light = motion.intensity
      const cx = width / 2
      const cy = height / 2
      const radius = size * 0.38

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      // Kürenin arkasından geçen yatay ışık çizgisi
      ctx.save()
      ctx.translate(cx, cy + radius * 0.62)
      ctx.scale(1, 0.08)
      let gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2)
      gradient.addColorStop(0, rgba(glow, 0.6 * light))
      gradient.addColorStop(0.35, rgba(accent, 0.2 * light))
      gradient.addColorStop(1, rgba(accent, 0))
      ctx.fillStyle = gradient
      ctx.fillRect(-width / 2, -width / 2, width, width)
      ctx.restore()

      // Dış ışıma
      gradient = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.7)
      gradient.addColorStop(0, rgba(accent, 0.34 * light))
      gradient.addColorStop(1, rgba(accent, 0))
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.7, 0, Math.PI * 2)
      ctx.fill()

      // Koyu cam disk
      ctx.globalCompositeOperation = 'source-over'
      gradient = ctx.createRadialGradient(cx, cy - radius * 0.2, radius * 0.1, cx, cy, radius)
      gradient.addColorStop(0, 'rgba(6, 16, 38, 0.97)')
      gradient.addColorStop(0.75, 'rgba(5, 18, 48, 0.95)')
      gradient.addColorStop(1, rgba(accent, 0.4))
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 0.985, 0, Math.PI * 2)
      ctx.fill()

      // Halkayı oluşturan, birbirinden farklı dalgalanan ışık telleri
      ctx.globalCompositeOperation = 'lighter'
      const wobble = 1 + motion.wave * 0.8 + level * 2.5
      for (let k = 0; k < 6; k++) {
        ctx.beginPath()
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * Math.PI * 2
          const offset =
            0.012 * Math.sin(3 * a + t * (1 + k * 0.35) + k * 1.7) +
            0.008 * Math.sin(7 * a - t * (0.8 + k * 0.2) + k)
          const r = radius * (1 + wobble * offset)
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const color = k === 0 ? white : k % 2 === 0 ? glow : accent
        ctx.lineWidth = 7
        ctx.strokeStyle = rgba(color, 0.06 * light)
        ctx.stroke()
        ctx.lineWidth = k === 0 ? 2.2 : 1.1
        ctx.strokeStyle = rgba(color, (k === 0 ? 0.85 : 0.45) * light)
        ctx.stroke()
      }

      // Halkanın çevresinde dolaşan kıvılcımlar
      for (const spark of sparks) {
        const a = spark.angle + t * 0.25 * spark.direction
        const r = radius * (1.03 + 0.07 * Math.sin(t * 1.3 + spark.seed * 10))
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + spark.seed * 20))
        ctx.fillStyle = rgba(glow, 0.7 * flicker * light)
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.1 + spark.seed * 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Ortadaki ses dalgası
      const amplitude = radius * 0.3 * (0.35 + motion.wave * 0.6 + level * 1.5)
      const halfWidth = radius * 0.42
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const u = (i / 80) * 2 - 1
        const envelope = Math.exp(-u * u * 3.2)
        const y =
          cy +
          Math.sin(u * 9 + t * 4) * amplitude * envelope * (0.55 + 0.45 * Math.sin(t * 2.3 + u * 3))
        const x = cx + u * halfWidth
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 10
      ctx.strokeStyle = rgba(glow, 0.14 * light)
      ctx.stroke()
      ctx.lineWidth = 3.2
      ctx.strokeStyle = rgba(glow, 0.95)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'

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
      style={{
        width: size * WIDTH_RATIO,
        maxWidth: '100%',
        aspectRatio: `${WIDTH_RATIO} / ${HEIGHT_RATIO}`
      }}
    />
  )
}

export default Orb
