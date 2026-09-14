// Konuşma algılama (VAD) olasılıklarından "kullanıcı konuşmaya başladı / bitirdi" kararını verir.
// Elektron'a ve modele bağlı değil; kare kare olasılık ve ses alır.

export interface EndpointerOptions {
  /** Bir karedeki örnek sayısı (16 kHz'de 512 = 32 ms) */
  frameSamples: number
  sampleRate: number
  /** Bu olasılığın üstü konuşma sayılır */
  threshold: number
  /** Konuşma başladı saymak için gereken kesintisiz konuşma süresi */
  minSpeechMs: number
  /** Konuşma bitti saymak için gereken sessizlik süresi */
  endSilenceMs: number
  /** Konuşmanın başlangıcından önce kayda eklenen süre (ilk hece kesilmesin) */
  preRollMs: number
  /** Bir konuşmanın en uzun süresi */
  maxSpeechMs: number
  /** Bu süre içinde hiç konuşma başlamazsa vazgeçilir */
  noSpeechTimeoutMs: number
}

export type EndpointResult =
  | { type: 'waiting' }
  | { type: 'speaking' }
  | { type: 'done'; audio: Float32Array }
  | { type: 'timeout' }

export const DEFAULT_ENDPOINTER: EndpointerOptions = {
  frameSamples: 512,
  sampleRate: 16000,
  threshold: 0.5,
  minSpeechMs: 120,
  endSilenceMs: 800,
  preRollMs: 320,
  maxSpeechMs: 15000,
  noSpeechTimeoutMs: 7000
}

// Konuşma sonrası sessizlikten kayda bırakılan kısım
const TRAILING_SILENCE_MS = 250

function concat(frames: Float32Array[]): Float32Array {
  const total = frames.reduce((sum, frame) => sum + frame.length, 0)
  const result = new Float32Array(total)
  let offset = 0
  for (const frame of frames) {
    result.set(frame, offset)
    offset += frame.length
  }
  return result
}

export class Endpointer {
  private readonly frameMs: number
  private frames: Float32Array[] = []
  private started = false
  private speechRun = 0
  private silenceRun = 0
  private elapsedMs = 0
  private speechMs = 0

  constructor(private readonly options: EndpointerOptions = DEFAULT_ENDPOINTER) {
    this.frameMs = (options.frameSamples / options.sampleRate) * 1000
  }

  reset(): void {
    this.frames = []
    this.started = false
    this.speechRun = 0
    this.silenceRun = 0
    this.elapsedMs = 0
    this.speechMs = 0
  }

  get isSpeaking(): boolean {
    return this.started
  }

  push(frame: Float32Array, probability: number): EndpointResult {
    const { threshold, minSpeechMs, preRollMs, noSpeechTimeoutMs, endSilenceMs, maxSpeechMs } =
      this.options
    this.elapsedMs += this.frameMs
    this.frames.push(frame)

    if (!this.started) {
      this.speechRun = probability >= threshold ? this.speechRun + 1 : 0
      // Başlamadan önce sadece ön kayıt + başlama süresi kadar kare tutulur
      const keep = Math.ceil((preRollMs + minSpeechMs) / this.frameMs)
      if (this.frames.length > keep) this.frames.splice(0, this.frames.length - keep)

      if (this.speechRun * this.frameMs >= minSpeechMs) {
        this.started = true
        this.silenceRun = 0
        this.speechMs = this.speechRun * this.frameMs
        return { type: 'speaking' }
      }
      return this.elapsedMs >= noSpeechTimeoutMs ? { type: 'timeout' } : { type: 'waiting' }
    }

    this.speechMs += this.frameMs
    // Konuşma sürerken eşik biraz düşük tutulur; kelime aralarındaki kısa düşüşler bitiş sayılmasın
    this.silenceRun = probability >= threshold - 0.15 ? 0 : this.silenceRun + 1

    if (this.silenceRun * this.frameMs >= endSilenceMs || this.speechMs >= maxSpeechMs) {
      const trimFrames = Math.max(
        0,
        this.silenceRun - Math.ceil(TRAILING_SILENCE_MS / this.frameMs)
      )
      const audio = concat(this.frames.slice(0, this.frames.length - trimFrames))
      this.reset()
      return { type: 'done', audio }
    }
    return { type: 'speaking' }
  }
}
