import { useEffect, useRef, useState } from 'react'

// Deneme sayfası (Tur O, adım 1): MediaPipe el takibinin bizim Electron/React
// ortamında çalışıp çalışmadığını görmek için izole bir prototip. Hiçbir gerçek
// özelliğe bağlı değil; sadece pinch (başparmak + işaret parmağı birleşmesi)
// algılanınca ekranda gösterge yanar. Modeller ve wasm CDN'den yükleniyor
// (jsdelivr / storage.googleapis.com); özellik onaylanırsa sonraki adımda
// holo-gestures'daki gibi depoya gömülüp çevrimdışı çalışacak şekilde taşınır.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const PINCH_THRESHOLD = 0.06

type Status = 'loading' | 'ready' | 'error'

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export default function GesturesPage(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [pinching, setPinching] = useState(false)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let rafId = 0

    async function start(): Promise<void> {
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
            const thumbTip = hand[4]
            const indexTip = hand[8]
            setPinching(distance(thumbTip, indexTip) < PINCH_THRESHOLD)
          } else {
            setPinching(false)
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
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-lg font-medium text-ink">Kamera el takibi (deneme)</h1>
      <p className="max-w-md text-center text-sm text-muted">
        Elini kameraya göster ve başparmak ile işaret parmağını birleştir (pinch). Algılanırsa
        aşağıdaki gösterge yanar. Bu sadece bir fizibilite denemesi, henüz hiçbir gerçek özelliğe
        bağlı değil.
      </p>
      <div className="relative overflow-hidden rounded-16 border border-line">
        <video ref={videoRef} className="w-[480px] -scale-x-100" muted playsInline />
      </div>
      {status === 'loading' && <p className="text-sm text-muted">Modeller yükleniyor...</p>}
      {status === 'error' && <p className="text-sm text-negative">Hata: {errorMessage}</p>}
      {status === 'ready' && (
        <div
          className={
            'rounded-10 border px-4 py-2 text-sm font-medium transition-colors ' +
            (pinching ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted')
          }
        >
          {pinching ? 'PINCH ALGILANDI' : 'bekleniyor...'}
        </div>
      )}
    </div>
  )
}
