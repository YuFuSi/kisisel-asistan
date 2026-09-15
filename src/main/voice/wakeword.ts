import * as ort from 'onnxruntime-node'

// openWakeWord akış hattı: ses → mel spektrogram → konuşma gömmesi (embedding) → "hey jarvis" puanı.
// Modeller 16 kHz sesle, 80 ms'lik (1280 örnek) parçalarla çalışır.

export const WAKE_CHUNK_SAMPLES = 1280
// Mel spektrogram, parçanın başındaki pencereler için önceki sesten bu kadar örnek ister
const MEL_CONTEXT_SAMPLES = 480
const MEL_BINS = 32
const EMBEDDING_WINDOW = 76
const MODEL_WINDOW = 16

export interface WakeWordModelPaths {
  melspectrogram: string
  embedding: string
  model: string
}

async function run(session: ort.InferenceSession, tensor: ort.Tensor): Promise<Float32Array> {
  const output = await session.run({ [session.inputNames[0]]: tensor })
  return output[session.outputNames[0]].data as Float32Array
}

export class WakeWordDetector {
  private context = new Float32Array(MEL_CONTEXT_SAMPLES)
  private mel: Float32Array[] = []
  private embeddings: Float32Array[] = []

  private constructor(
    private readonly melSession: ort.InferenceSession,
    private readonly embeddingSession: ort.InferenceSession,
    private readonly modelSession: ort.InferenceSession
  ) {}

  static async load(paths: WakeWordModelPaths): Promise<WakeWordDetector> {
    // Tek iş parçacığı yeter; model çok küçük ve bilgisayarı meşgul etmesin
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1
    }
    const [mel, embedding, model] = await Promise.all([
      ort.InferenceSession.create(paths.melspectrogram, options),
      ort.InferenceSession.create(paths.embedding, options),
      ort.InferenceSession.create(paths.model, options)
    ])
    return new WakeWordDetector(mel, embedding, model)
  }

  /** Algılamadan sonra veya dinleme yeniden başlarken önceki ses unutulur */
  reset(): void {
    this.context = new Float32Array(MEL_CONTEXT_SAMPLES)
    this.mel = []
    this.embeddings = []
  }

  /** 80 ms'lik (1280 örnek, -1..1) sesi işler; "hey jarvis" söylenmiş olma olasılığını (0-1) döndürür */
  async process(chunk: Float32Array): Promise<number> {
    if (chunk.length !== WAKE_CHUNK_SAMPLES) {
      throw new Error(`Uyandırma kelimesi ${WAKE_CHUNK_SAMPLES} örneklik parça bekliyor.`)
    }

    // Model 16 bit tamsayı ölçeğinde ses bekliyor
    const input = new Float32Array(MEL_CONTEXT_SAMPLES + WAKE_CHUNK_SAMPLES)
    input.set(this.context)
    for (let i = 0; i < chunk.length; i++) input[MEL_CONTEXT_SAMPLES + i] = chunk[i] * 32767
    this.context = input.slice(-MEL_CONTEXT_SAMPLES)

    const melOutput = await run(
      this.melSession,
      new ort.Tensor('float32', input, [1, input.length])
    )
    for (let offset = 0; offset + MEL_BINS <= melOutput.length; offset += MEL_BINS) {
      const frame = new Float32Array(MEL_BINS)
      // openWakeWord'ün eğitimde kullandığı ölçekleme
      for (let j = 0; j < MEL_BINS; j++) frame[j] = melOutput[offset + j] / 10 + 2
      this.mel.push(frame)
    }
    if (this.mel.length > EMBEDDING_WINDOW) this.mel.splice(0, this.mel.length - EMBEDDING_WINDOW)
    if (this.mel.length < EMBEDDING_WINDOW) return 0

    const melWindow = new Float32Array(EMBEDDING_WINDOW * MEL_BINS)
    this.mel.forEach((frame, i) => melWindow.set(frame, i * MEL_BINS))
    const embedding = await run(
      this.embeddingSession,
      new ort.Tensor('float32', melWindow, [1, EMBEDDING_WINDOW, MEL_BINS, 1])
    )
    this.embeddings.push(Float32Array.from(embedding))
    if (this.embeddings.length > MODEL_WINDOW) this.embeddings.shift()
    if (this.embeddings.length < MODEL_WINDOW) return 0

    const size = this.embeddings[0].length
    const features = new Float32Array(MODEL_WINDOW * size)
    this.embeddings.forEach((vector, i) => features.set(vector, i * size))
    const score = await run(
      this.modelSession,
      new ort.Tensor('float32', features, [1, MODEL_WINDOW, size])
    )
    return score[0]
  }
}
