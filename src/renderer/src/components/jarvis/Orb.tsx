import { useEffect, useRef } from 'react'
import { STATE_LABELS, type AssistantState } from '../../lib/assistantState'
import { getAudioLevel, getAudioSpectrum } from '../../lib/audioLevel'
import { orbHsl } from '../../lib/orbColor'

interface OrbProps {
  state: AssistantState
  /** Kürenin yaklaşık çapı (px) */
  size?: number
}

// idle: dönmez, sadece nefes alır. Diğerleri halkaya açılır ve döner.
const RING_STATES = new Set<AssistantState>(['listening', 'thinking', 'working', 'speaking'])
const PARTICLE_COUNT = 900
const BAND_COUNT = 40
const HUE_CYCLE_SECONDS = 40

interface Particle {
  /** Küre üzerindeki hedef konum (birim küre) */
  sx: number
  sy: number
  sz: number
  /** Halka üzerindeki hedef konum (aynı parçacık, farklı form) */
  rx: number
  ry: number
  rz: number
  seed: number
  phase: number
  band: number
}

function buildParticles(): Particle[] {
  const particles: Particle[] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    const sx = Math.cos(theta) * radiusAtY
    const sz = Math.sin(theta) * radiusAtY

    const ringAngle = ((i / PARTICLE_COUNT) * Math.PI * 2 * 7) % (Math.PI * 2)
    const ringRadius = 0.72 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.3 - 0.15
    const rx = Math.cos(ringAngle) * ringRadius
    const ry = Math.sin(ringAngle) * ringRadius * 0.96
    const rz = Math.sin(i * 78.233) * 0.5 * 0.15

    particles.push({
      sx,
      sy: y,
      sz,
      rx,
      ry,
      rz,
      seed: Math.random(),
      phase: Math.random() * Math.PI * 2,
      band: i % BAND_COUNT
    })
  }
  return particles
}

// Jarvis küresi: durumuna göre küre <-> halka arası morph yapan, çok renkli parçacık bulutu (canvas ile çizilir)
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

    const width = size
    const height = size
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const particles = buildParticles()
    const radius = size * 0.38

    let morph = 0
    let hueTime = 0
    let last = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const draw = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const currentState = stateRef.current
      const morphTarget = RING_STATES.has(currentState) ? 1 : 0
      morph += (morphTarget - morph) * (reduced ? 1 : Math.min(dt * 2.5, 1))
      hueTime = reduced ? hueTime : hueTime + dt / HUE_CYCLE_SECONDS

      const t = reduced ? 0 : now / 1000
      const breathe = reduced ? 1 : 1 + Math.sin((t * (Math.PI * 2)) / 4) * 0.03

      const spectrum =
        currentState === 'listening'
          ? getAudioSpectrum('input', BAND_COUNT)
          : currentState === 'speaking'
            ? getAudioSpectrum('output', BAND_COUNT)
            : null
      const overallLevel =
        currentState === 'listening'
          ? getAudioLevel('input')
          : currentState === 'speaking'
            ? getAudioLevel('output')
            : 0

      const cx = width / 2
      const cy = height / 2
      const cosR = Math.cos(t * 0.15)
      const sinR = Math.sin(t * 0.15)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Dış ışıma
      const glowColor = orbHsl(hueTime, currentState, 85, 60)
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.6)
      glow.addColorStop(0, glowColor.replace('hsl', 'hsla').replace(')', ', 0.28)'))
      glow.addColorStop(1, glowColor.replace('hsl', 'hsla').replace(')', ', 0)'))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalCompositeOperation = 'lighter'

      const projected = particles.map((p) => {
        let x = p.sx + (p.rx - p.sx) * morph
        let y = p.sy + (p.ry - p.sy) * morph
        let z = p.sz + (p.rz - p.sz) * morph

        if (morph > 0.05) {
          if (spectrum) {
            // Dinliyor/konuşuyor: her parçacık kendi frekans bandının seviyesine göre dışa/içe hareket eder
            const bandLevel = spectrum[p.band]
            const push = 1 + bandLevel * 0.6
            x *= push
            y *= push
          } else {
            // Düşünüyor/çalışıyor: spiral akış + hafif rastgele sapma (hibrit)
            const spiralT = ((p.seed * 6 + t * 0.6) % 1) * morph
            const jitter = Math.sin(t * 5 + p.phase) * 0.04 * morph
            x = x * (1 - spiralT * 0.3) + jitter
            y = y * (1 - spiralT * 0.3) + jitter
          }
        }

        x *= breathe
        y *= breathe
        z *= breathe

        const rx2 = x * cosR - z * sinR
        const rz2 = x * sinR + z * cosR
        const scale = 1 / (2.1 - rz2 * 0.6)
        const wave = Math.sin(x * 3 + t * 1.4) * Math.cos(y * 2.5 - t) * 0.5 + 0.5
        return {
          x: cx + rx2 * radius * scale,
          y: cy + y * radius * scale,
          z: rz2,
          wave,
          seed: p.seed
        }
      })
      projected.sort((a, b) => a.z - b.z)

      for (const p of projected) {
        const depth = (p.z + 1) / 2
        const bright = 0.2 + depth * 0.5 + p.wave * 0.3 + overallLevel * 0.3
        const pSize = 0.6 + depth * 1.3 + p.wave * 0.6 + overallLevel * 1
        const color = orbHsl(hueTime + p.seed * 0.15, currentState, 90, 55 + p.wave * 15)
        ctx.globalAlpha = Math.min(1, bright)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 2 + p.wave * 3
        ctx.beginPath()
        ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
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
      style={{ width: size, height: size, maxWidth: '100%' }}
    />
  )
}

export default Orb
