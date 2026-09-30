import type { AssistantState, Emotion } from './assistantState'

// Jarvis'in yüzü: kürenin içinden yanan ışıktan iki göz. Durumu renk değil gözler anlatır;
// küre hep aynı lila kalır. Büyük kürede ve küçük "damla"da aynı yüz kullanılır.

export interface FaceParams {
  /** Göz açıklığı (1 = normal); göz kırpma bunu anlık olarak sıfıra indirir */
  open: number
  /** Göz genişliği çarpanı */
  width: number
  /** Bakış yönü, -1..1 (sağ ve aşağı pozitif) */
  lookX: number
  lookY: number
  /** 0..1: gözler ^ ^ biçimine döner (iş bitti) */
  smile: number
  /** 0..1: gözler × × olur (hata) */
  cross: number
  /** 0..1: göz ışığının parlaklığı */
  glow: number
  /** 0..1: onay bekleme işareti (küçük amber ünlem) */
  alert: number
}

export const NEUTRAL_FACE: FaceParams = {
  open: 1,
  width: 1,
  lookX: 0,
  lookY: 0,
  smile: 0,
  cross: 0,
  glow: 0.75,
  alert: 0
}

/** Durum ve (varsa) kısa duyguya göre yüzün hedefi; çizim bu hedefe yumuşakça yaklaşır */
export function faceTarget(state: AssistantState, emotion: Emotion | null): FaceParams {
  if (emotion === 'success') return { ...NEUTRAL_FACE, smile: 1, glow: 0.95 }
  if (emotion === 'error') return { ...NEUTRAL_FACE, cross: 1, glow: 0.55 }
  switch (state) {
    case 'listening':
      // Dinlerken gözler büyür ve kullanıcıya "bakar"
      return { ...NEUTRAL_FACE, open: 1.25, width: 1.1, glow: 1 }
    case 'thinking':
      // Düşünürken yukarı-yana bakar, gözler biraz kısılır
      return { ...NEUTRAL_FACE, open: 0.8, lookX: 0.45, lookY: -0.5, glow: 0.8 }
    case 'working':
      // Çalışırken bakış, çalışan adıma çevrilir (bkz. Orb); burada sadece odak
      return { ...NEUTRAL_FACE, open: 0.9, glow: 0.9 }
    case 'speaking':
      return { ...NEUTRAL_FACE, open: 1.05, glow: 0.9 }
    case 'approval':
      // Onay beklerken sana bakar ve yanında küçük bir ünlem belirir
      return { ...NEUTRAL_FACE, open: 1.1, alert: 1, glow: 0.9 }
    default:
      return NEUTRAL_FACE
  }
}

/** İki yüz arasında yumuşak geçiş (0 = a, 1 = b) */
export function mixFace(a: FaceParams, b: FaceParams, amount: number): FaceParams {
  const k = Math.min(1, Math.max(0, amount))
  const mix = (x: number, y: number): number => x + (y - x) * k
  return {
    open: mix(a.open, b.open),
    width: mix(a.width, b.width),
    lookX: mix(a.lookX, b.lookX),
    lookY: mix(a.lookY, b.lookY),
    smile: mix(a.smile, b.smile),
    cross: mix(a.cross, b.cross),
    glow: mix(a.glow, b.glow),
    alert: mix(a.alert, b.alert)
  }
}

/** Göz kırpma: 0..1 arası kapanma miktarı (140 ms'lik yumuşak kapanıp açılma) */
export function blinkAmount(sinceBlinkMs: number): number {
  const BLINK_MS = 140
  if (sinceBlinkMs < 0 || sinceBlinkMs > BLINK_MS) return 0
  return Math.sin((sinceBlinkMs / BLINK_MS) * Math.PI)
}

/** Bir sonraki göz kırpmaya kadar bekleme: 2,8-6 sn arası, arada çift kırpma */
export function nextBlinkDelay(random: number): number {
  return random < 0.15 ? 260 : 2800 + random * 3200
}

interface DrawFaceOptions {
  cx: number
  cy: number
  /** Gövde yarıçapı */
  r: number
  /** Göz ışığının rengi (hsla metni üretir) */
  tone: (lightness: number, alpha?: number) => string
  /** Küçük boyutta ışıma daha az, çizgiler daha kalın */
  small: boolean
  /** Konuşurken ses enerjisi (0..1): göz ışığı ritimle hafifçe parlar */
  energy: number
}

// Gözler ön yüzde, merkezin biraz üstünde; aralarındaki mesafe ve boyutları gövdeye oranlı
const EYE_GAP = 0.62
const EYE_HEIGHT = 0.4
const EYE_WIDTH = 0.2
const EYE_RAISE = 0.06
const LOOK_RANGE = 0.16

/** Yüzü tuvale çizer; gövde zaten çizilmiş olmalı */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  face: FaceParams,
  { cx, cy, r, tone, small, energy }: DrawFaceOptions
): void {
  const baseX = cx + face.lookX * r * LOOK_RANGE
  const baseY = cy - r * EYE_RAISE + face.lookY * r * LOOK_RANGE * 0.8
  const w = r * EYE_WIDTH * face.width
  const h = Math.max(r * EYE_HEIGHT * face.open, w * 0.18)
  const glow = Math.min(1, face.glow + energy * 0.25)
  const line = Math.max(small ? 1.6 : 2.2, w * 0.34)

  ctx.save()
  ctx.shadowColor = tone(78, 0.9 * glow)
  ctx.shadowBlur = (small ? 4 : 16) * glow
  ctx.fillStyle = tone(94, 0.95 * glow)
  ctx.strokeStyle = tone(94, 0.95 * glow)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = line

  for (const side of [-1, 1]) {
    const x = baseX + side * r * EYE_GAP * 0.5 * (1 + (face.width - 1) * 0.3)
    const plain = 1 - Math.max(face.smile, face.cross)
    if (plain > 0.02) {
      // Normal göz: dikey, yuvarlak köşeli ışık çubuğu
      ctx.globalAlpha = plain
      ctx.beginPath()
      ctx.roundRect(x - w / 2, baseY - h / 2, w, h, w / 2)
      ctx.fill()
    }
    if (face.smile > 0.02) {
      // ^ ^ : yukarı kıvrık yay
      ctx.globalAlpha = face.smile
      ctx.beginPath()
      ctx.arc(x, baseY + w * 0.55, w * 0.8, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    }
    if (face.cross > 0.02) {
      // × × : çapraz iki kısa çizgi
      const s = w * 0.75
      ctx.globalAlpha = face.cross
      ctx.beginPath()
      ctx.moveTo(x - s, baseY - s)
      ctx.lineTo(x + s, baseY + s)
      ctx.moveTo(x + s, baseY - s)
      ctx.lineTo(x - s, baseY + s)
      ctx.stroke()
    }
  }
  ctx.restore()

  if (face.alert > 0.02) {
    // Onay bekleme işareti: gövdenin sağ üstünde küçük amber daire ve ünlem
    const ax = cx + r * 0.72
    const ay = cy - r * 0.72
    const ar = Math.max(small ? 5 : 7, r * 0.16)
    ctx.save()
    ctx.globalAlpha = face.alert
    ctx.fillStyle = 'hsl(38, 88%, 58%)'
    ctx.beginPath()
    ctx.arc(ax, ay, ar, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'hsl(30, 70%, 14%)'
    ctx.fillRect(ax - ar * 0.12, ay - ar * 0.55, ar * 0.24, ar * 0.62)
    ctx.beginPath()
    ctx.arc(ax, ay + ar * 0.42, ar * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
