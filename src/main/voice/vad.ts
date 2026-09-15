import * as ort from 'onnxruntime-node'

// Silero VAD (v5): 16 kHz seste 32 ms'lik karenin konuşma olma olasılığı.
// Model her karede önceki karenin son 64 örneğini ve kendi iç durumunu (state) ister.

export const VAD_FRAME_SAMPLES = 512
const CONTEXT_SAMPLES = 64
const STATE_SHAPE = [2, 1, 128]

export class SileroVad {
  private state = new Float32Array(2 * 128)
  private context = new Float32Array(CONTEXT_SAMPLES)
  // Model örnekleme hızını skaler (boyutsuz) tensör olarak ister
  private readonly sampleRate = new ort.Tensor('int64', BigInt64Array.from([BigInt(16000)]), [])

  private constructor(private readonly session: ort.InferenceSession) {}

  static async load(modelPath: string): Promise<SileroVad> {
    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1
    })
    return new SileroVad(session)
  }

  reset(): void {
    this.state = new Float32Array(2 * 128)
    this.context = new Float32Array(CONTEXT_SAMPLES)
  }

  /** 512 örneklik (-1..1) karenin konuşma olasılığı (0-1) */
  async probability(frame: Float32Array): Promise<number> {
    if (frame.length !== VAD_FRAME_SAMPLES) {
      throw new Error(`Konuşma algılama ${VAD_FRAME_SAMPLES} örneklik kare bekliyor.`)
    }
    const input = new Float32Array(CONTEXT_SAMPLES + VAD_FRAME_SAMPLES)
    input.set(this.context)
    input.set(frame, CONTEXT_SAMPLES)

    const output = await this.session.run({
      input: new ort.Tensor('float32', input, [1, input.length]),
      state: new ort.Tensor('float32', this.state, STATE_SHAPE),
      sr: this.sampleRate
    })
    this.state = Float32Array.from(output.stateN.data as Float32Array)
    this.context = input.slice(-CONTEXT_SAMPLES)
    return (output.output.data as Float32Array)[0]
  }
}
