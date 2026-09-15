import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_ENDPOINTER, Endpointer } from '../lib/endpointer'
import { cleanTranscript } from '../lib/transcript'
import { resolveVoicePaths } from './pack'
import { PiperVoice } from './piper'
import { SileroVad, VAD_FRAME_SAMPLES } from './vad'
import { WAKE_CHUNK_SAMPLES, WakeWordDetector } from './wakeword'
import { WhisperServer } from './whisper'
import { decodeWav, encodeWav, resample } from '../../shared/wav'

// Gerçek ses paketiyle uçtan uca deneme: Piper konuşur → konuşma algılama keser → whisper yazıya çevirir.
// Paket sadece kullanıcının bilgisayarında kurulu; CI'da ve paket yoksa atlanır.
const root = join(process.env.APPDATA ?? '', 'kisisel-asistan', 'voice')
const paths = resolveVoicePaths(root)
const ready =
  process.platform === 'win32' &&
  paths.piper !== null &&
  paths.piperVoice !== null &&
  paths.whisperServer !== null &&
  paths.whisperModel !== null &&
  paths.wakeword !== null
const vadModel = resolve('resources/voice/silero_vad.onnx')

const piper = ready ? new PiperVoice(paths.piper!, paths.piperVoice!) : null
const whisper = ready ? new WhisperServer(paths.whisperServer!, paths.whisperModel!) : null

afterAll(() => {
  piper?.stop()
  whisper?.stop()
})

async function speak(text: string): Promise<Float32Array> {
  const wav = decodeWav(await piper!.synthesize(text))
  return resample(wav.samples, wav.sampleRate, 16000)
}

describe.skipIf(!ready || !existsSync(vadModel))('yerel ses hattı (gerçek modeller)', () => {
  it('Türkçe cümleyi seslendirir, konuşmayı keser ve yazıya çevirir', async () => {
    const speech = await speak('Yarın sabah saat dokuzda toplantımı hatırlat.')
    const silence = (seconds: number): Float32Array => new Float32Array(16000 * seconds)
    const audio = new Float32Array(16000 + speech.length + 16000 * 2)
    audio.set(silence(1))
    audio.set(speech, 16000)

    const vad = await SileroVad.load(vadModel)
    const endpointer = new Endpointer(DEFAULT_ENDPOINTER)
    let captured: Float32Array | null = null
    let maxProbability = 0
    for (let offset = 0; offset + VAD_FRAME_SAMPLES <= audio.length; offset += VAD_FRAME_SAMPLES) {
      const frame = audio.slice(offset, offset + VAD_FRAME_SAMPLES)
      const probability = await vad.probability(frame)
      maxProbability = Math.max(maxProbability, probability)
      const result = endpointer.push(frame, probability)
      if (result.type === 'done') {
        captured = result.audio
        break
      }
    }
    console.info(`VAD en yüksek olasılık: ${maxProbability.toFixed(2)}`)
    expect(captured).not.toBeNull()
    // Kesilen ses, konuşmanın tamamını kapsamalı ama baştaki 1 sn sessizliğin çoğunu içermemeli
    expect(captured!.length).toBeGreaterThan(speech.length * 0.8)
    expect(captured!.length).toBeLessThan(speech.length + 16000 * 1.5)

    const started = Date.now()
    const text = cleanTranscript(await whisper!.transcribe(encodeWav(captured!, 16000)))
    console.info(`Whisper (${Date.now() - started} ms, ilk yükleme dahil): "${text}"`)
    expect(text.toLocaleLowerCase('tr-TR')).toContain('toplantı')

    const second = Date.now()
    const again = cleanTranscript(await whisper!.transcribe(encodeWav(speech, 16000)))
    console.info(`Whisper ikinci istek (${Date.now() - second} ms): "${again}"`)
    expect(again.toLocaleLowerCase('tr-TR')).toContain('hatırlat')
  }, 180_000)

  it('uyandırma kelimesi modeli çalışır ve sessizlikte tetiklenmez', async () => {
    const detector = await WakeWordDetector.load(paths.wakeword!)
    const run = async (audio: Float32Array): Promise<number> => {
      detector.reset()
      let max = 0
      for (
        let offset = 0;
        offset + WAKE_CHUNK_SAMPLES <= audio.length;
        offset += WAKE_CHUNK_SAMPLES
      ) {
        max = Math.max(
          max,
          await detector.process(audio.slice(offset, offset + WAKE_CHUNK_SAMPLES))
        )
      }
      return max
    }

    const silenceScore = await run(new Float32Array(16000 * 3))
    const unrelated = await speak('Bugün hava çok güzel, dışarı çıkalım mı?')
    const unrelatedScore = await run(unrelated)
    const padded = (samples: Float32Array): Float32Array => {
      const out = new Float32Array(16000 * 2 + samples.length)
      out.set(samples, 16000)
      return out
    }
    const wakeScore = await run(padded(await speak('Hey Carvis.')))
    console.info(
      `Uyandırma puanları: sessizlik ${silenceScore.toFixed(3)}, ilgisiz cümle ${unrelatedScore.toFixed(3)}, "Hey Carvis" (Türkçe sesle) ${wakeScore.toFixed(3)}`
    )
    expect(silenceScore).toBeLessThan(0.1)
    expect(unrelatedScore).toBeLessThan(0.5)
    expect(wakeScore).toBeGreaterThanOrEqual(0)
    expect(wakeScore).toBeLessThanOrEqual(1)
  }, 120_000)
})
