import { useEffect, useRef, useState } from 'react'

// Tur O: MediaPipe HandLandmarker ile pinch algılama ve el konumu. `enabled` false iken kamera
// hiç açılmaz. Model ve wasm CDN'den yükleniyor (jsdelivr / storage.googleapis.com); bu yüzden
// index.html'deki CSP'ye bu iki kaynak eklendi. Özellik kalıcı olursa self-host edilip
// çevrimdışı çalışacak şekilde taşınmalı (bkz. holo-gestures örneği).
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
// Histerezis: tek bir sabit eşik, mesafe tam sınırdayken kare-kare true/false arasında titreyip
// yanlışlıkla art arda kavrama/bırakma tetikliyordu. Girişte daha sıkı (PINCH_ENTER), çıkışta
// daha gevşek (PINCH_EXIT) bir eşik kullanmak bu titremeyi ortadan kaldırıyor.
const PINCH_ENTER = 0.05
const PINCH_EXIT = 0.075
// Ham parmak ucu konumu kare-kare titrek geliyor; üstel hareketli ortalama (EMA) ile yumuşatılıyor.
// handPoint (yörünge hover'ı) ve handNormalized (pencere sürükleme, ekran mutlak konumu) ZIT
// ihtiyaçlar: hover'da titremesizlik, sürüklemede gecikmesizlik önemli. Tek bir ortak alfa ikisi
// arasında hep taviz oluyordu (biri iyileşince öteki kötüleşiyordu); bu yüzden ikisi artık ayrı
// EMA zincirleriyle, aynı ham konumdan bağımsız hesaplanıyor.
const HOVER_SMOOTHING = 0.35
const DRAG_SMOOTHING = 0.65
// El hızlı hareket ederken veya kısa bir an bulanıklaşınca MediaPipe tek bir karede eli kaçırabiliyor.
// Bunu anında "el yok" sayıp pinch/sürükleme/kavrama durumunu sıfırlamak yerine, birkaç ardışık kare
// (yaklaşık 150 ms, 60 kare/sn'de) boyunca son bilinen durum korunuyor; el gerçekten gittiyse bu süre
// sonunda sıfırlanıyor.
const MISSED_FRAMES_TOLERANCE = 9

export type HandTrackingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface HandPoint {
  x: number
  y: number
}

export interface HandTrackingResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: HandTrackingStatus
  errorMessage: string
  pinching: boolean
  handPoint: HandPoint | null
  /** İki el birden görünüyorsa aralarındaki normalize (0-1) mesafe; tek elde/elsizde null.
   *  İki elle büyütme/küçültme jesti için — eller açılıp kapanınca değişir. */
  twoHandSpread: number | null
  /** İşaret parmağı ucunun ham, aynalanmış normalize (0-1) konumu; ekran mutlak konumuna
   *  eşlemek (ör. pencere sürükleme) için — handPoint'in aksine kazanç uygulanmamıştır. */
  handNormalized: HandPoint | null
}

function distance(a: HandPoint, b: HandPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Ham kare-kare mesafe/konum titrek geliyor (MediaPipe'in kendi gürültüsü); üstel hareketli
// ortalama (EMA) ile yumuşatılıyor. Alfa küçüldükçe daha yumuşak ama daha gecikmeli olur.
const SPREAD_SMOOTHING = 0.15

function smooth(previous: number | null, next: number, alpha: number): number {
  return previous === null ? next : previous + (next - previous) * alpha
}

/** @param gainX/gainY Elin normalize (0-1) konumunu merkeze göre px'e çeviren kazanç */
export function useHandTracking(
  enabled: boolean,
  gainX: number,
  gainY: number
): HandTrackingResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<HandTrackingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [pinching, setPinching] = useState(false)
  const [handPoint, setHandPoint] = useState<HandPoint | null>(null)
  const [twoHandSpread, setTwoHandSpread] = useState<number | null>(null)
  const [handNormalized, setHandNormalized] = useState<HandPoint | null>(null)

  useEffect(() => {
    if (!enabled) {
      // react-hooks/set-state-in-effect: senkron değil, mikro görev içinde çağrılır
      void Promise.resolve().then(() => {
        setStatus('idle')
        setPinching(false)
        setHandPoint(null)
        setTwoHandSpread(null)
        setHandNormalized(null)
      })
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let rafId = 0

    async function start(): Promise<void> {
      setStatus('loading')
      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          // Varsayılanlar (0.5) sınırda titriyordu — daha yüksek güven eşiği daha kararlı
          // algılama sağlıyor, karşılığında biraz daha geç algılama kabul ediliyor
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.7,
          minTrackingConfidence: 0.7
        })
        if (cancelled) return

        stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setStatus('ready')

        let smoothedSpread: number | null = null
        let hoverX: number | null = null
        let hoverY: number | null = null
        let dragX: number | null = null
        let dragY: number | null = null
        let isPinching = false
        let missedFrames = 0

        function loop(): void {
          if (cancelled || !video) return
          const result = landmarker.detectForVideo(video, performance.now())
          const hand = result.landmarks[0]
          const secondHand = result.landmarks[1]
          if (!hand && !secondHand && missedFrames < MISSED_FRAMES_TOLERANCE) {
            // Tek karelik kayıp: son bilinen durum korunur, hiçbir şey sıfırlanmaz
            missedFrames += 1
            rafId = requestAnimationFrame(loop)
            return
          }
          if (hand || secondHand) missedFrames = 0
          if (secondHand) {
            // İki el birden görünüyorsa yörünge hover/pinch'i devre dışı bırakılır (karışmasın);
            // avuç içi merkezi (landmark 9) elin kendisi kadar sabit, parmak ucuna göre daha az titrek
            isPinching = false
            setPinching(false)
            setHandPoint(null)
            setHandNormalized(null)
            hoverX = null
            hoverY = null
            dragX = null
            dragY = null
            smoothedSpread = smooth(
              smoothedSpread,
              distance(hand[9], secondHand[9]),
              SPREAD_SMOOTHING
            )
            setTwoHandSpread(smoothedSpread)
          } else if (hand) {
            const pinchDistance = distance(hand[4], hand[8])
            // Histerezis: kavrarken sıkı eşik, bırakırken gevşek eşik — sınırda titremeyi önler
            isPinching = isPinching ? pinchDistance < PINCH_EXIT : pinchDistance < PINCH_ENTER
            setPinching(isPinching)
            // Ham parmak ucu konumu (mirror düzeltmeden önce) iki ayrı hızda yumuşatılır
            hoverX = smooth(hoverX, hand[8].x, HOVER_SMOOTHING)
            hoverY = smooth(hoverY, hand[8].y, HOVER_SMOOTHING)
            dragX = smooth(dragX, hand[8].x, DRAG_SMOOTHING)
            dragY = smooth(dragY, hand[8].y, DRAG_SMOOTHING)
            // MediaPipe koordinatı aynalanmamış ham görüntüye göre; kullanıcı ekranda kendini
            // aynalanmış görüyor, bu yüzden x ters çevrilip merkeze göre px'e çevriliyor
            setHandPoint({ x: (0.5 - hoverX) * gainX, y: (hoverY - 0.5) * gainY })
            setHandNormalized({ x: 1 - dragX, y: dragY })
            smoothedSpread = null
            setTwoHandSpread(null)
          } else {
            isPinching = false
            setPinching(false)
            setHandPoint(null)
            setHandNormalized(null)
            hoverX = null
            hoverY = null
            dragX = null
            dragY = null
            smoothedSpread = null
            setTwoHandSpread(null)
          }
          rafId = requestAnimationFrame(loop)
        }
        loop()
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [enabled, gainX, gainY])

  return { videoRef, status, errorMessage, pinching, handPoint, twoHandSpread, handNormalized }
}
