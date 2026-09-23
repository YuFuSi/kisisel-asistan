import { useEffect, useRef } from 'react'

// Tur O: "El ile kontrol"ü bir düğmeye değil, iki hızlı alkışa bağlar — elleri kameraya
// göstermeden önce ellerin serbest olması gerektiği için düğmeye basmak zaten tuhaf oluyordu.
// Sabit bir eşik yerine kendiliğinden kalibre olan bir yöntem kullanılıyor: ortam gürültüsünün
// yavaş hareketli ortalaması (baseline) tutulur, bu ortalamanın kat kat üstüne çıkan ani bir
// sıçrama "alkış" sayılır. Bu, mikrofonun giriş seviyesi düşük olan makinelerde de (bu projede
// bilinen bir donanım sorunu) çalışır çünkü sabit bir ses seviyesine bağlı değil.
// Eşikler ilk denemede çok düşüktü (hafif "tık" sesleri bile tetikliyordu); gerçek bir alkışın
// hem ortam gürültüsüne göre belirgin bir sıçrama olması hem de belirli bir mutlak yükseklikte
// olması isteniyor. Hâlâ çok/az hassassa bu iki sabit ayarlanır.
const SPIKE_MULTIPLIER = 8
const MIN_ABS_THRESHOLD = 0.05
const BASELINE_SMOOTHING = 0.02
const CLAP_REFRACTORY_MS = 150
const DOUBLE_CLAP_WINDOW_MS = 700
const FFT_SIZE = 1024

export function useClapActivation(enabled: boolean, onDoubleClap: () => void): void {
  const onDoubleClapRef = useRef(onDoubleClap)

  useEffect(() => {
    onDoubleClapRef.current = onDoubleClap
  }, [onDoubleClap])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let rafId = 0

    async function start(): Promise<void> {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        audioCtx = new AudioContext()
        // Chromium, kullanıcı etkileşimi olmadan oluşturulan AudioContext'i "suspended" başlatabilir
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        source.connect(analyser)
        const data = new Float32Array(analyser.fftSize)

        let baseline = MIN_ABS_THRESHOLD
        let lastClapAt = 0
        let firstClapAt = 0

        function loop(): void {
          if (cancelled) return
          analyser.getFloatTimeDomainData(data)
          let sumSquares = 0
          for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i]
          const rms = Math.sqrt(sumSquares / data.length)
          const now = performance.now()
          const isSpike =
            rms > baseline * SPIKE_MULTIPLIER + MIN_ABS_THRESHOLD &&
            now - lastClapAt > CLAP_REFRACTORY_MS

          if (isSpike) {
            if (firstClapAt && now - firstClapAt < DOUBLE_CLAP_WINDOW_MS) {
              onDoubleClapRef.current()
              firstClapAt = 0
            } else {
              firstClapAt = now
            }
            lastClapAt = now
          } else {
            baseline = baseline * (1 - BASELINE_SMOOTHING) + rms * BASELINE_SMOOTHING
          }
          rafId = requestAnimationFrame(loop)
        }
        loop()
      } catch {
        // Mikrofon izni yoksa alkış aktivasyonu sessizce çalışmaz; başka bir kritik özellik
        // buna bağlı olmadığı için hata göstermeye gerek yok.
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
      void audioCtx?.close()
    }
  }, [enabled])
}
