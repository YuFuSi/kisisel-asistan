import { useEffect, useRef } from 'react'
import {
  getReplyChunks,
  STATE_LABELS,
  type AssistantState,
  type EmotionSignal
} from '../../lib/assistantState'
import { BAND_COUNT, getAudioLevel, getAudioSpectrum } from '../../lib/audioLevel'
import { capUnfocused, startFrameLoop } from '../../lib/frameLoop'
import { createSphereRenderer } from '../../lib/orbGl'
import { playSfx } from '../../lib/soundEffects'
import { orbHslaShift, orbRgb, STATE_HUE_SHIFT } from '../../lib/orbColor'
import { getOrbPrefs, orbLook } from '../../lib/orbPrefs'
import {
  blinkAmount,
  drawFace,
  faceTarget,
  mixFace,
  NEUTRAL_FACE,
  nextBlinkDelay,
  type FaceParams
} from '../../lib/orbFace'
import type { WorkStep } from '../../lib/workSteps'

interface OrbProps {
  state: AssistantState
  /** Tuvalin kenarı (px); küre bunun yaklaşık %30'u kadardır, halkalara ve ışımaya yer kalır */
  size?: number
  /** 0-1: yazı yazılırken gibi anlık heyecan; ses seviyesi gibi iç ışığı ve parçacıkları canlandırır */
  excite?: number
  /** Kısa duygu sinyali: iş bitti (yeşil parıltı), hata (kırmızı sarsıntı), onay bekliyor (amber yalpalama) */
  emotion?: EmotionSignal | null
  /** Çalışan araç adımları: her biri kürenin çevresinde bir nokta olur */
  steps?: WorkStep[]
  /** Her bildirimde artan sayaç: küre iki kez nabız atar */
  notice?: number
  /** Cam görünüm (Jarvis Cam): yüzey noktaları ve yere düşen ışık yok; arkadaki halka OrbHalo'da */
  glass?: boolean
}

// Hızlı ince ayar için tüm sayılar burada
const SPHERE_RATIO = 0.3
const BREATH_SECONDS = 5
const BREATH_AMOUNT = 0.02
const EASE_PER_SECOND = 3
const SMALL_SIZE = 120
const HUE_DRIFT = 10
const SURFACE_DOTS = 620
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
  speaking: { listen: 0, arcs: 0, speak: 1 },
  approval: { listen: 0, arcs: 0, speak: 0 }
}

interface Shape {
  /** Gövdenin yatay ve dikey ölçeği (1 = küre) */
  sx: number
  sy: number
  /** Jiroskop halkaları: 1 = iki halka, 2 = üç halka */
  rings: number
}

// Her durumda kürenin aldığı biçim: düşünürken/çalışırken küçülüp halkalara döner, konuşurken yuvarlak kalıp yüzeyi titrer
const SHAPES: Record<AssistantState, Shape> = {
  idle: { sx: 1, sy: 1, rings: 0 },
  listening: { sx: 1.05, sy: 1.05, rings: 0 },
  thinking: { sx: 0.88, sy: 0.88, rings: 1 },
  working: { sx: 0.82, sy: 0.82, rings: 2 },
  speaking: { sx: 1.05, sy: 1.05, rings: 0 },
  approval: { sx: 1, sy: 1, rings: 0 }
}
const MORPH_PER_SECOND = 3.2

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

const NO_STEPS: WorkStep[] = []
// Adım noktaları arasındaki açı ve kürenin çevresindeki yarıçap çarpanı
const STEP_SPACING = TAU / 14
const STEP_RING = 1.26

// Jarvis küresi: cam gibi yarı saydam gövde, iç sis, yüzey parçacıkları; dinlerken ve konuşurken
// çevresinde ses çubuğu halkası, düşünürken dönen yaylar
function Orb({
  state,
  size = 240,
  excite = 0,
  emotion = null,
  steps = NO_STEPS,
  notice = 0,
  glass = false
}: OrbProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const exciteRef = useRef(excite)
  const emotionRef = useRef<EmotionSignal | null>(emotion)
  const stepsRef = useRef<WorkStep[]>(steps)
  const hoverRef = useRef(false)
  const tapRef = useRef(0)
  const noticeRef = useRef(notice)

  useEffect(() => {
    stateRef.current = state
    exciteRef.current = excite
    emotionRef.current = emotion
    stepsRef.current = steps
    noticeRef.current = notice
  }, [state, excite, emotion, steps, notice])

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
    // Küçük kürede (çentik, başlık çubuğu) noktalar seyrek olsun: yoğunluk yüzey alanıyla orantılı kalır
    const dotScale = Math.min(1, (size / 300) ** 2)
    const surface =
      small || glass ? [] : buildDots(Math.max(120, Math.round(SURFACE_DOTS * dotScale)), false)
    // Gövde için WebGL (küçük küre ve WebGL'siz ortam 2D gövdeyle çizer)
    const sphere = small ? null : createSphereRenderer(size, dpr)
    // Ses çubuklarının yumuşatılmış değerleri (aynalı: BAND_COUNT * 2 çubuk)
    const bars = new Array<number>(BAND_COUNT * 2).fill(0)

    const params: Params = { ...TARGETS[stateRef.current] }
    const shape: Shape = { ...SHAPES[stateRef.current] }
    // Ses çubuklarının ortalaması: konuşurken yüzey titremesinin genliğini belirler
    let barMean = 0
    // Durum tonu anında değil, yarım saniyelik yumuşak geçişle değişir
    let hueShift = STATE_HUE_SHIFT[stateRef.current]
    let level = 0
    // İç ışık ve parlaklık için çok yavaş yumuşatılmış ses enerjisi (göz yormasın diye ayrı tutulur)
    let energy = 0
    let flow = 0
    let spin = 0
    // Duygu: yeni bir sinyal geldiğinde başlangıç zamanı tutulur; açılışta eski sinyal sayılmaz
    let emotionSeen = emotionRef.current?.seq ?? -1
    let emotionStart = 0
    // Adım noktalarının görünürlüğü yumuşakça artar ve azalır
    let stepsAmount = 0
    let prevState = stateRef.current
    let wakeStart = -1e9
    let tapSeen = tapRef.current
    let tapStart = -1e9
    let hover = 0
    let noticeSeen = noticeRef.current
    let noticeStart = -1e9
    // İmleç yönü: kürenin merkezine göre -1..1 (uzaktaki imleç de aynı yöne bakar); pencereden çıkınca ortaya döner
    const pointer = { x: 0, y: 0 }
    let gazeX = 0
    let gazeY = 0
    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      // Yakında hassas, uzakta doygun: yönü korur, büyüklüğü yumuşakça 1'e yaklaşır
      const strength = Math.min(dist / (size * 0.6), 1)
      pointer.x = (dx / dist) * strength
      pointer.y = (dy / dist) * strength
    }
    const onPointerLeave = (): void => {
      pointer.x = 0
      pointer.y = 0
    }
    if (!small) {
      window.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerleave', onPointerLeave)
    }
    // Yüz: hedefe yumuşakça yaklaşan göz parametreleri ve rastgele aralıklı göz kırpma
    let face: FaceParams = { ...NEUTRAL_FACE }
    let blinkStart = -1e9
    let nextBlink = performance.now() + nextBlinkDelay(Math.random())
    let chunksSeen = getReplyChunks()
    let kick = 0
    let last = performance.now()

    const draw = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const current = stateRef.current
      const target = TARGETS[current]
      const ease = reduced ? 1 : Math.min(dt * EASE_PER_SECOND, 1)
      params.listen += (target.listen - params.listen) * ease
      params.arcs += (target.arcs - params.arcs) * ease
      params.speak += (target.speak - params.speak) * ease
      const goal = SHAPES[current]
      const morph = reduced ? 1 : Math.min(dt * MORPH_PER_SECOND, 1)
      shape.sx += (goal.sx - shape.sx) * morph
      shape.sy += (goal.sy - shape.sy) * morph
      shape.rings += (goal.rings - shape.rings) * morph

      const rawLevel =
        current === 'listening'
          ? getAudioLevel('input')
          : current === 'speaking'
            ? getAudioLevel('output')
            : 0
      const energyTarget = Math.max(rawLevel, exciteRef.current)
      level += (energyTarget - level) * (reduced ? 1 : Math.min(dt * 12, 1))
      energy += (energyTarget - energy) * (reduced ? 1 : Math.min(dt * 1.6, 1))
      const look = orbLook()
      if (!reduced) flow += dt * (1 + energy * 0.9) * look.factor
      if (!reduced) spin += dt * (current === 'working' ? 1.6 : 0.8)

      hueShift += (STATE_HUE_SHIFT[current] - hueShift) * (reduced ? 1 : Math.min(dt * 2, 1))
      const t = reduced ? 0 : now / 1000
      // Renk çok az kayar: taban vurgu tonu etrafında küçük bir salınım
      const drift = reduced
        ? 0
        : Math.sin(t * 0.21) * HUE_DRIFT + Math.sin(t * 0.13 + 1.3) * HUE_DRIFT * 0.5
      const tone = (lightness: number, alpha = 1, hueOffset = 0): string =>
        orbHslaShift(hueShift, lightness, alpha, hueOffset + drift + look.hue)
      // Uyandırma: dinlemeye geçilince küre bir kez "kabarır" ve dışa doğru halka yayılır
      if (current !== prevState) {
        if (current === 'listening' && prevState === 'idle') wakeStart = now
        prevState = current
      }
      // Dokunma: imleç üzerindeyken hafifçe büyür, tıklanınca içe basılıp halka yayar
      if (tapRef.current !== tapSeen) {
        tapSeen = tapRef.current
        tapStart = now
      }
      if (noticeRef.current !== noticeSeen) {
        noticeSeen = noticeRef.current
        noticeStart = now
      }
      // İki yumuşak nabız (2,4 sn): kürenin ışığı iki kez kabarıp söner
      const noticeP = reduced ? 1 : (now - noticeStart) / 2400
      const noticeBeat =
        noticeP >= 0 && noticeP < 1 ? Math.sin(noticeP * TAU) ** 2 * (1 - noticeP) : 0
      hover += ((hoverRef.current ? 1 : 0) - hover) * (reduced ? 1 : Math.min(dt * 8, 1))
      const wakeP = reduced ? 1 : (now - wakeStart) / 1100
      const tapP = reduced ? 1 : (now - tapStart) / 900
      const wakeBump = wakeP >= 0 && wakeP < 1 ? Math.sin(Math.PI * wakeP) * 0.05 : 0
      const press = tapP >= 0 && tapP < 0.25 ? Math.sin((Math.PI * tapP) / 0.25) * 0.05 : 0
      // Göz takibi: küre imlece doğru "bakar"; ışık, sis ve yüzey noktaları imleç yönüne kayar
      const gazeEase = reduced ? 1 : Math.min(dt * 5, 1)
      gazeX += ((reduced ? 0 : pointer.x) - gazeX) * gazeEase
      gazeY += ((reduced ? 0 : pointer.y) - gazeY) * gazeEase
      // Cevap nabzı: cevap yazılırken her yeni parçada küre çok hafif atar, parçalar seyrekleşince söner
      const chunks = getReplyChunks()
      if (chunks !== chunksSeen) {
        chunksSeen = chunks
        kick = Math.min(kick + 0.35, 1)
      }
      kick *= reduced ? 0 : Math.exp(-dt * 6)
      const breath = 1 + Math.sin((t * TAU) / BREATH_SECONDS) * BREATH_AMOUNT
      const r =
        radius *
        breath *
        (1 + wakeBump + hover * 0.025 - press + noticeBeat * 0.035 + kick * 0.014) *
        (1 + energy * 0.08 * params.speak + energy * 0.03 * params.listen)
      const voice = Math.max(params.listen, params.speak)

      // Duygu hâlleri: geçici (başarı/hata) sinyaller süreyle, kararsızlık (onay bekleme) sürekli
      const signal = emotionRef.current
      if (signal && signal.seq !== emotionSeen) {
        emotionSeen = signal.seq
        emotionStart = now
      }
      let burstKind: 'success' | 'error' | null = null
      if (signal && signal.kind !== 'unsure') {
        const progress = (now - emotionStart) / (signal.kind === 'success' ? 1800 : 2200)
        if (progress >= 0 && progress < 1) burstKind = signal.kind
      }
      // Küre hep lila kalır; durum ve duyguyu gözler anlatır (sarsıntı, renk boyama yok).
      // Yüz kapalıysa (Ayarlar) eski davranışın sakin hâli kalır: sadece biçim ve ritim.
      const faceOn = getOrbPrefs().face
      if (faceOn) {
        const goal = { ...faceTarget(current, burstKind) }
        // Çalışırken bakış, kürenin çevresinde çalışan adıma döner
        const running = stepsRef.current.findIndex((step) => step.status === 'running')
        if (current === 'working' && running >= 0) {
          const angle = -Math.PI / 2 + running * STEP_SPACING
          goal.lookX = Math.cos(angle) * 0.7
          goal.lookY = Math.sin(angle) * 0.7
        } else if (current === 'idle' || current === 'listening' || current === 'approval') {
          // Boştayken ve dinlerken imlece bakar
          goal.lookX += gazeX * 0.7
          goal.lookY += gazeY * 0.6
        }
        face = reduced ? goal : mixFace(face, goal, Math.min(dt * 7, 1))
        if (!reduced && now > nextBlink) {
          blinkStart = now
          nextBlink = now + nextBlinkDelay(Math.random())
        }
      }
      const blink =
        reduced || face.smile > 0.3 || face.cross > 0.3 ? 0 : blinkAmount(now - blinkStart)

      // Gövde çevresi: konuşurken yüzey sesle birlikte yumuşakça titrer, aksi halde düz daire
      const wobble = params.speak * (0.005 + barMean * 0.02)
      const outline = (rad: number): void => {
        ctx.beginPath()
        if (wobble < 0.002 || reduced) {
          ctx.arc(cx, cy, rad, 0, TAU)
          return
        }
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * TAU
          const k =
            1 +
            wobble *
              (Math.sin(3 * a + t * 2.1) +
                0.6 * Math.sin(5 * a - t * 3.3) +
                0.4 * Math.sin(7 * a + t * 4.2))
          const x = cx + Math.cos(a) * rad * k
          const y = cy + Math.sin(a) * rad * k
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      ctx.save()

      if (!small && !glass) {
        // Yere düşen yumuşak ışıma: küre havada asılı gibi dursun
        ctx.save()
        ctx.translate(cx, cy + r * (0.35 + 1.2 * shape.sy))
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

      // Gövde ve içindekiler biçim ölçeğiyle birlikte yassılır ya da küçülür
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(shape.sx, shape.sy)
      ctx.translate(-cx, -cy)

      if (small && faceOn) {
        // Damla: küçük boyutta küre yerine yumuşak, hafif basık bir gövde; yüz asıl kimlik
        ctx.fillStyle = tone(22, 0.96)
        ctx.beginPath()
        ctx.ellipse(cx, cy + r * 0.05, r * 1.1, r, 0, 0, TAU)
        ctx.fill()
      } else if (sphere) {
        // Gövde: WebGL gölgelendiriciyle gerçek 3B ışıklı cam küre (normal, Fresnel, hacimli sis)
        const hue = hueShift + drift + look.hue
        sphere.render({
          radius: r,
          flow,
          energy,
          kick,
          intensity: look.factor,
          gaze: [gazeX, gazeY],
          colorA: orbRgb(hue, 66),
          colorB: orbRgb(hue + 26, 58),
          colorRim: orbRgb(hue, 72)
        })
        ctx.save()
        outline(r)
        ctx.clip()
        ctx.drawImage(sphere.canvas, 0, 0, size, size)
        ctx.restore()
      } else {
        // Gövde: koyu bir taban üstünde yarı saydam cam; dolgun değil, kenara doğru yoğunlaşır
        ctx.fillStyle = 'rgba(9, 10, 14, 0.92)'
        outline(r)
        ctx.fill()
        const glass = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r)
        glass.addColorStop(0, tone(76, 0.12))
        glass.addColorStop(0.6, tone(62, 0.16))
        glass.addColorStop(0.88, tone(56, 0.34))
        glass.addColorStop(1, tone(66, 0.6))
        ctx.fillStyle = glass
        outline(r)
        ctx.fill()
      }

      if (!small) {
        // İç sis (2D yedek): küreyle kırpılmış, yavaş süzülen soluk ışık bulutları
        ctx.save()
        outline(r)
        ctx.clip()
        for (const blob of sphere ? [] : BLOBS) {
          const bx = cx + Math.sin(flow * blob.speedX + blob.phase) * r * 0.5
          const by = cy + Math.cos(flow * blob.speedY + blob.phase * 1.7) * r * 0.5
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * blob.size)
          g.addColorStop(
            0,
            tone(
              blob.lightness,
              Math.min(blob.alpha * look.factor * (1 + energy * 0.3 + kick * 0.25), 0.9),
              blob.hue
            )
          )
          g.addColorStop(1, tone(blob.lightness, 0, blob.hue))
          ctx.fillStyle = g
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        }
        ctx.restore()

        // Yüzey parçacıkları: küreyi tanımlayan, hafif parıldayan noktalar
        const yaw = t * 0.09 + gazeX * 0.4
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        const pitch = gazeY * 0.3
        const cosP = Math.cos(pitch)
        const sinP = Math.sin(pitch)
        for (const dot of surface) {
          const x = dot.x * cosY - dot.z * sinY
          const zYaw = dot.x * sinY + dot.z * cosY
          const dy = dot.y * cosP - zYaw * sinP
          const z = dot.y * sinP + zYaw * cosP
          if (z < -0.15) continue
          const depth = (z + 1) / 2
          const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + dot.seed * 40)
          ctx.fillStyle = tone(
            84,
            (0.16 + depth * 0.5 + twinkle * 0.3) * (0.9 + energy * 0.2),
            dot.seed * 16
          )
          ctx.beginPath()
          ctx.arc(cx + x * r * 0.98, cy + dy * r * 0.98, 0.7 + depth * 1 + energy * 0.25, 0, TAU)
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
        if (!sphere) {
          ctx.fillStyle = gloss
          outline(r)
          ctx.fill()
        }
      }

      // Kenar ışığı: kürenin cam gibi görünmesini sağlayan ince parlak çizgi
      ctx.lineWidth = small ? 1.2 : 1.6
      ctx.strokeStyle = tone(82, small && faceOn ? 0.85 : 0.55)
      if (small && faceOn) {
        ctx.beginPath()
        ctx.ellipse(cx, cy + r * 0.05, r * 1.1 - 0.6, r - 0.6, 0, 0, TAU)
      } else {
        outline(r - 0.8)
      }
      ctx.stroke()
      if (faceOn) {
        drawFace(
          ctx,
          { ...face, open: face.open * (1 - blink) },
          {
            cx,
            cy: small ? cy + r * 0.05 : cy,
            r,
            tone: (lightness, alpha = 1) => tone(lightness, alpha),
            small,
            energy: params.speak * level
          }
        )
      }
      ctx.restore()

      // Dinlerken ve konuşurken: kürenin çevresinde ses çubuğu halkası.
      // Dinlerken gerçek mikrofon bantları, konuşurken cevabın ses bantları (yoksa yapay dalga) çizilir.
      if (voice > 0.01 && !small) {
        const source = current === 'speaking' ? 'output' : 'input'
        const spectrum = getAudioSpectrum(source, BAND_COUNT)
        const total = spectrum.reduce((sum, v) => sum + v, 0)
        const count = bars.length
        let barSum = 0
        for (let i = 0; i < count; i++) {
          const band = i < BAND_COUNT ? i : count - 1 - i
          const real = Math.min(1, spectrum[band] * 2.6)
          const synthetic =
            0.22 + 0.26 * Math.sin(t * 5 + i * 0.55) * Math.sin(t * 2.3 + i * 0.21 + 1)
          // Ses geliyorsa gerçek bant, konuşurken ses analizi yoksa yapay dalga
          const value =
            total > 0.02 ? real : current === 'speaking' ? Math.max(0.05, synthetic) : 0.05
          bars[i] += (value - bars[i]) * (reduced ? 1 : Math.min(dt * 16, 1))
          barSum += bars[i]
          const angle = (i / count) * TAU - Math.PI / 2
          const rx = r * shape.sx * 1.16
          const ry = r * shape.sy * 1.16
          let length = 3 + bars[i] * r * (current === 'speaking' ? 0.5 : 0.36)
          // Çubuk tuval kenarında kesilmesin: iki eksende de sınırın içinde kalacak uzunluğa kırp
          const cosA = Math.abs(Math.cos(angle))
          const sinA = Math.abs(Math.sin(angle))
          const room = size / 2 - 2
          if (cosA > 0.01) length = Math.min(length, room / cosA - rx)
          if (sinA > 0.01) length = Math.min(length, room / sinA - ry)
          length = Math.max(2, length)
          ctx.lineWidth = current === 'speaking' ? 3 : 2
          ctx.lineCap = 'round'
          ctx.strokeStyle = tone(78, (0.35 + bars[i] * 0.6) * voice)
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry)
          ctx.lineTo(cx + Math.cos(angle) * (rx + length), cy + Math.sin(angle) * (ry + length))
          ctx.stroke()
        }
        barMean = barSum / count
      }

      // Küçük boyutta tek bir dönen yay yeter
      if (small && params.arcs > 0.01) {
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.strokeStyle = tone(78, Math.min(params.arcs, 1) * 0.8)
        ctx.beginPath()
        ctx.arc(cx, cy, r * 1.32, spin, spin + 1.1)
        ctx.stroke()
      }

      // Düşünürken iki, çalışırken üç eğik halka jiroskop gibi kürenin çevresinde döner
      if (!small && shape.rings > 0.01) {
        for (let i = 0; i < 3; i++) {
          const presence = i < 2 ? Math.min(shape.rings, 1) : Math.max(0, shape.rings - 1)
          if (presence < 0.01) continue
          const rx = r * (1.4 + i * 0.1)
          const ry = rx * (0.3 + i * 0.12)
          const tilt = spin * (0.5 + i * 0.3) * (i % 2 === 0 ? 1 : -1) + i * 1.05
          ctx.lineWidth = 1.2
          ctx.strokeStyle = tone(78, 0.28 * presence)
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, tilt, 0, TAU)
          ctx.stroke()
          const start = spin * (1.4 + i * 0.4) + i * 2
          ctx.lineWidth = 2.4
          ctx.lineCap = 'round'
          ctx.strokeStyle = tone(82, 0.85 * presence, i * 8)
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, tilt, start, start + 1.15)
          ctx.stroke()
        }
      }

      // Konuşurken: gövdenin biçimini izleyen, dışa yayılan yumuşak dalga
      if (params.speak > 0.01) {
        const phase = (t * 0.9) % 1
        const grow = 1.02 + phase * 0.14 + energy * 0.03
        ctx.lineWidth = 2
        ctx.strokeStyle = tone(78, (1 - phase) * 0.5 * params.speak)
        ctx.beginPath()
        ctx.ellipse(cx, cy, r * shape.sx * grow, r * shape.sy * grow, 0, 0, TAU)
        ctx.stroke()
      }
      // İş ilerleyişi: her araç adımı kürenin çevresinde bir nokta; biten dolu, çalışan nabız atar, hatalı kırmızı
      const stepList = stepsRef.current
      stepsAmount +=
        ((stepList.length > 0 ? 1 : 0) - stepsAmount) * (reduced ? 1 : Math.min(dt * 4, 1))
      if (!small && stepsAmount > 0.01) {
        const ringRadius = r * STEP_RING
        const start = -Math.PI / 2
        const count = stepList.length
        if (count > 1) {
          ctx.lineWidth = 1
          ctx.strokeStyle = tone(80, 0.22 * stepsAmount)
          ctx.beginPath()
          ctx.arc(cx, cy, ringRadius, start, start + STEP_SPACING * (count - 1))
          ctx.stroke()
        }
        for (let i = 0; i < count; i++) {
          const step = stepList[i]
          const angle = start + i * STEP_SPACING
          const x = cx + Math.cos(angle) * ringRadius
          const y = cy + Math.sin(angle) * ringRadius
          if (step.status === 'running') {
            const beat = 0.5 + 0.5 * Math.sin(t * 6)
            ctx.fillStyle = tone(88, 0.95 * stepsAmount)
            ctx.beginPath()
            ctx.arc(x, y, 4 + beat * 1.2, 0, TAU)
            ctx.fill()
            ctx.lineWidth = 1.5
            ctx.strokeStyle = tone(82, (0.6 - 0.4 * beat) * stepsAmount)
            ctx.beginPath()
            ctx.arc(x, y, 7 + beat * 5, 0, TAU)
            ctx.stroke()
          } else {
            ctx.fillStyle =
              step.status === 'error'
                ? `hsla(355, 85%, 68%, ${0.95 * stepsAmount})`
                : tone(84, 0.9 * stepsAmount)
            ctx.beginPath()
            ctx.arc(x, y, 3.2, 0, TAU)
            ctx.fill()
          }
        }
      }
      // Uyandırma ve dokunma halkaları
      if (!small) {
        if (wakeP >= 0 && wakeP < 1) {
          ctx.lineWidth = 2
          ctx.strokeStyle = tone(80, (1 - wakeP) * 0.55)
          ctx.beginPath()
          ctx.arc(cx, cy, r * (1.02 + wakeP * 0.5), 0, TAU)
          ctx.stroke()
        }
        if (noticeBeat > 0.01) {
          ctx.lineWidth = 2
          ctx.strokeStyle = tone(84, noticeBeat * 0.55)
          ctx.beginPath()
          ctx.arc(cx, cy, r * (1.04 + noticeBeat * 0.12), 0, TAU)
          ctx.stroke()
        }
        if (tapP >= 0.1 && tapP < 1) {
          const q = (tapP - 0.1) / 0.9
          ctx.lineWidth = 1.5
          ctx.strokeStyle = tone(84, (1 - q) * 0.45)
          ctx.beginPath()
          ctx.arc(cx, cy, r * (1 + q * 0.32), 0, TAU)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Kare hızı: hareket azaltmada 2, ses/heyecan varken 60, beklemede 30; pencere odakta değilse en fazla 15
    const fps = (): number => {
      if (reduced) return 2
      const busy =
        stateRef.current !== 'idle' || exciteRef.current > 0 || energy > 0.02 || kick > 0.01
      return capUnfocused(busy ? 60 : 24, 12)
    }
    // Gizli sayfadaki (ör. arkada duran Asistan sayfası) küre hiç çizilmez
    const stopLoop = startFrameLoop(draw, fps, () => canvas.offsetParent !== null)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      stopLoop()
      sphere?.dispose()
    }
  }, [size, glass])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Jarvis: ${STATE_LABELS[state]}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
      onPointerEnter={() => {
        hoverRef.current = true
      }}
      onPointerLeave={() => {
        hoverRef.current = false
      }}
      onPointerDown={() => {
        tapRef.current += 1
        playSfx('tap')
      }}
    />
  )
}

export default Orb
