import { useEffect, useRef, useState } from 'react'

// Tur O: MediaPipe HandLandmarker ile pinch algılama ve el konumu. `enabled` false iken kamera
// hiç açılmaz. Model ve wasm CDN'den yükleniyor (jsdelivr / storage.googleapis.com); bu yüzden
// index.html'deki CSP'ye bu iki kaynak eklendi. Özellik kalıcı olursa self-host edilip
// çevrimdışı çalışacak şekilde taşınmalı (bkz. holo-gestures örneği).
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const PINCH_THRESHOLD = 0.06

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
}

function distance(a: HandPoint, b: HandPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
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

  useEffect(() => {
    if (!enabled) {
      // react-hooks/set-state-in-effect: senkron değil, mikro görev içinde çağrılır
      void Promise.resolve().then(() => {
        setStatus('idle')
        setPinching(false)
        setHandPoint(null)
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
          numHands: 1
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

        function loop(): void {
          if (cancelled || !video) return
          const result = landmarker.detectForVideo(video, performance.now())
          const hand = result.landmarks[0]
          if (hand) {
            setPinching(distance(hand[4], hand[8]) < PINCH_THRESHOLD)
            // MediaPipe koordinatı aynalanmamış ham görüntüye göre; kullanıcı ekranda kendini
            // aynalanmış görüyor, bu yüzden x ters çevrilip merkeze göre px'e çevriliyor
            setHandPoint({ x: (0.5 - hand[8].x) * gainX, y: (hand[8].y - 0.5) * gainY })
          } else {
            setPinching(false)
            setHandPoint(null)
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

  return { videoRef, status, errorMessage, pinching, handPoint }
}
