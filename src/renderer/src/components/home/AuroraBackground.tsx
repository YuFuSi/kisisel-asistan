import { useEffect, useRef } from 'react'
import type { AssistantState } from '../../lib/assistantState'
import { capUnfocused, startFrameLoop } from '../../lib/frameLoop'
import { orbHsla } from '../../lib/orbColor'

interface AuroraBackgroundProps {
  state: AssistantState
}

// Hızlı ince ayar: sis lekeleri ve yıldız tozu
const MISTS = [
  { x: 0.5, y: 0.3, size: 0.55, speed: 0.045, phase: 0, hue: 0, alpha: 0.13 },
  { x: 0.25, y: 0.5, size: 0.45, speed: 0.06, phase: 2.4, hue: -30, alpha: 0.09 },
  { x: 0.78, y: 0.4, size: 0.5, speed: 0.05, phase: 4.6, hue: 34, alpha: 0.09 }
]
const STAR_COUNT = 70
const RESOLUTION = 0.5

// Ana Sayfa'nın arkasında çok yavaş akan aurora sisi ve hafif yıldız tozu; renk duruma göre tonlanır
function AuroraBackground({ state }: AuroraBackgroundProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const parent = canvas.parentElement
    if (!parent) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: fract(Math.sin(i * 12.9898) * 43758.5453),
      y: fract(Math.sin(i * 78.233) * 12345.6789),
      seed: fract(Math.sin(i * 39.346) * 9871.123),
      size: 0.5 + fract(Math.sin(i * 5.17) * 777.7) * 1.1
    }))

    let width = 0
    let height = 0
    // Yumuşak sis için yarım çözünürlük yeter; tuval CSS ile büyütülür, çizim maliyeti dörtte birine iner
    const scale = RESOLUTION

    const resize = (): void => {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    const draw = (now: number): void => {
      const current = stateRef.current
      const t = reduced ? 0 : now / 1000
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const span = Math.max(width, height)
      for (const mist of MISTS) {
        const mx = width * (mist.x + Math.sin(t * mist.speed + mist.phase) * 0.08)
        const my = height * (mist.y + Math.cos(t * mist.speed * 1.3 + mist.phase) * 0.06)
        const radius = span * mist.size
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, radius)
        g.addColorStop(0, orbHsla(current, 60, mist.alpha, mist.hue))
        g.addColorStop(1, orbHsla(current, 60, 0, mist.hue))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, width, height)
      }

      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.8 + star.seed * 30)
        ctx.fillStyle = orbHsla(current, 88, 0.08 + twinkle * 0.3, star.seed * 40)
        ctx.beginPath()
        ctx.arc(star.x * width, star.y * height, star.size * 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Arka plan yavaş aktığı için 12 fps yeter; hareket azaltmada saniyede 1, odakta değilken 6
    const stop = startFrameLoop(draw, () => (reduced ? 1 : capUnfocused(12, 6)))
    return () => {
      stop()
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}

function fract(value: number): number {
  return value - Math.floor(value)
}

export default AuroraBackground
