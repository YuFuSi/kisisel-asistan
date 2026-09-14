// AudioWorklet (ses iş parçacığı): mikrofon sesini 16 kHz'e indirir ve 80 ms'lik (1280 örnek)
// parçalar halinde gönderir. Ana sürecteki uyandırma kelimesi ve konuşma algılama bu biçimi bekler.

declare const sampleRate: number
declare function registerProcessor(name: string, processor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

const CHUNK_SAMPLES = 1280
const TARGET_RATE = 16000

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  private readonly ratio = sampleRate / TARGET_RATE
  private buffer = new Float32Array(CHUNK_SAMPLES)
  private filled = 0
  // Hedef örneğe düşen giriş örneklerinin ortalaması alınır (basit kenar yumuşatma)
  private sum = 0
  private count = 0
  private position = 0

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    if (!input) return true
    for (let i = 0; i < input.length; i++) {
      this.sum += input[i]
      this.count++
      this.position++
      if (this.position < this.ratio) continue
      this.position -= this.ratio
      this.buffer[this.filled++] = this.sum / this.count
      this.sum = 0
      this.count = 0
      if (this.filled === CHUNK_SAMPLES) {
        this.port.postMessage(this.buffer, [this.buffer.buffer])
        this.buffer = new Float32Array(CHUNK_SAMPLES)
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor('voice-capture', VoiceCaptureProcessor)
