// Mikrofon kaydı (sohbet kutusundaki mikrofon düğmesi). Kayıt bitince ses 16 kHz WAV'a çevrilip
// ana sürece gönderilir; yerel konuşma tanıma (whisper.cpp) bu biçimi ister, bulut servisleri de kabul eder.
import { setListening } from './assistantState'
import { analyserLevel, analyserSpectrum, registerLevel, registerSpectrum } from './audioLevel'
import { encodeWav, resample } from '../../../shared/wav'

export interface Recording {
  /** Kaydı bitirir ve 16 kHz WAV sesini döndürür */
  stop: () => Promise<{ audio: ArrayBuffer; mimeType: string }>
  /** Kaydı iptal eder, ses verisi kullanılmaz */
  cancel: () => void
}

const TARGET_RATE = 16000

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

/** Tarayıcının kaydettiği (webm/opus) sesi tek kanallı 16 kHz WAV'a çevirir */
async function toWav(blob: Blob): Promise<ArrayBuffer> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const mono = new Float32Array(decoded.length)
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel)
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / decoded.numberOfChannels
    }
    return encodeWav(resample(mono, decoded.sampleRate, TARGET_RATE), TARGET_RATE)
  } finally {
    void context.close()
  }
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

  // Kayıt sürerken ses seviyesi ölçülür (Jarvis küresi buna göre titreşir)
  const audioContext = new AudioContext()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  audioContext.createMediaStreamSource(stream).connect(analyser)
  const unregisterLevel = registerLevel('input', () => analyserLevel(analyser))
  const unregisterSpectrum = registerSpectrum('input', () => analyserSpectrum(analyser, 40))
  setListening(true)

  const releaseMicrophone = (): void => {
    stream.getTracks().forEach((track) => track.stop())
    unregisterLevel()
    unregisterSpectrum()
    void audioContext.close()
    setListening(false)
  }

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone()
            toWav(new Blob(chunks, { type: mimeType })).then(
              (audio) => resolve({ audio, mimeType: 'audio/wav' }),
              () => reject(new Error('Ses kaydı çözümlenemedi, tekrar dene.'))
            )
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
