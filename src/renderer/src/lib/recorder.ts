// Mikrofon kaydı. Kayıt bitince sesi ana sürece gönderip yazıya çevirtiyoruz.
import { setListening } from './assistantState'

export interface Recording {
  /** Kaydı bitirir ve ses verisini döndürür */
  stop: () => Promise<{ audio: ArrayBuffer; mimeType: string }>
  /** Kaydı iptal eder, ses verisi kullanılmaz */
  cancel: () => void
}

// Kayıt sürerken ses seviyesini ölçen düğüm (Jarvis küresi buna göre titreşir)
let analyser: AnalyserNode | null = null

function describeMicError(error: unknown): Error {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError') {
    return new Error(
      'Mikrofon izni verilmedi. Windows ayarlarından uygulamalar için mikrofon erişimine izin ver.'
    )
  }
  if (name === 'NotFoundError') return new Error('Mikrofon bulunamadı.')
  return new Error('Mikrofon açılamadı.')
}

/** Kayıt sürüyorsa 0-1 arası ses seviyesi, değilse 0 */
export function getInputLevel(): number {
  if (!analyser) return 0
  const samples = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(samples)
  let sum = 0
  for (const sample of samples) {
    const value = (sample - 128) / 128
    sum += value * value
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}

export async function startRecording(): Promise<Recording> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    throw describeMicError(error)
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  const audioContext = new AudioContext()
  const level = audioContext.createAnalyser()
  level.fftSize = 512
  audioContext.createMediaStreamSource(stream).connect(level)
  analyser = level
  setListening(true)

  const releaseMicrophone = (): void => {
    stream.getTracks().forEach((track) => track.stop())
    if (analyser === level) analyser = null
    void audioContext.close()
    setListening(false)
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone()
            const blob = new Blob(chunks, { type: mimeType })
            void blob.arrayBuffer().then((audio) => resolve({ audio, mimeType }))
          },
          { once: true }
        )
        recorder.stop()
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      releaseMicrophone()
    }
  }
}
