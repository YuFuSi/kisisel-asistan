import { app } from 'electron'
import { join } from 'node:path'
import vadModelPath from '../../../resources/voice/silero_vad.onnx?asset'
import { getSettings } from '../settings'
import { resolveVoicePaths, type VoicePaths } from './pack'
import { PiperVoice } from './piper'
import { SileroVad } from './vad'
import { WakeWordDetector } from './wakeword'
import { WhisperServer } from './whisper'

// Yerel ses motorlarının tek kopyası: whisper sunucusu, Piper sesi, uyandırma kelimesi ve konuşma algılama.
// Motorlar ilk kullanıldıklarında yüklenir; paket sonradan kurulursa yollar yeniden okunur.

export const voiceDirectory = (): string => join(app.getPath('userData'), 'voice')

let whisper: WhisperServer | null = null
let piper: PiperVoice | null = null
let wakeWord: Promise<WakeWordDetector> | null = null
let vad: Promise<SileroVad> | null = null

export function getVoicePaths(): VoicePaths {
  return resolveVoicePaths(voiceDirectory())
}

export function isLocalSttReady(): boolean {
  const paths = getVoicePaths()
  return paths.whisperServer !== null && paths.whisperModel !== null
}

export function isPiperReady(): boolean {
  const paths = getVoicePaths()
  return paths.piper !== null && paths.piperVoice !== null
}

export function getWhisper(): WhisperServer {
  if (whisper) return whisper
  const { whisperServer, whisperModel } = getVoicePaths()
  if (!whisperServer || !whisperModel) {
    throw new Error(
      'İnternetsiz konuşma tanıma kurulu değil. Ayarlar > Ses bölümünden Jarvis ses paketini indir.'
    )
  }
  whisper = new WhisperServer(whisperServer, whisperModel)
  return whisper
}

// Ayarlar'daki hız çarpanının Piper'ın length_scale'ine çevrilmesi (ters orantı: çarpan büyüdükçe süre kısalır)
const lengthScaleFromRate = (rate: number): number => Math.round((1 / rate) * 1000) / 1000

export function getPiper(): PiperVoice {
  const lengthScale = lengthScaleFromRate(getSettings().speechRate)
  if (piper) {
    piper.setLengthScale(lengthScale)
    return piper
  }
  const paths = getVoicePaths()
  if (!paths.piper || !paths.piperVoice) {
    throw new Error('Türkçe ses kurulu değil. Ayarlar > Ses bölümünden Jarvis ses paketini indir.')
  }
  piper = new PiperVoice(paths.piper, paths.piperVoice, lengthScale)
  return piper
}

export function getWakeWordDetector(): Promise<WakeWordDetector> {
  if (!wakeWord) {
    const paths = getVoicePaths().wakeword
    if (!paths) {
      return Promise.reject(
        new Error('"Hey Jarvis" modeli kurulu değil. Ayarlar > Ses bölümünden ses paketini indir.')
      )
    }
    wakeWord = WakeWordDetector.load(paths).catch((err: unknown) => {
      wakeWord = null
      throw err
    })
  }
  return wakeWord
}

export function getVad(): Promise<SileroVad> {
  if (!vad) {
    vad = SileroVad.load(vadModelPath).catch((err: unknown) => {
      vad = null
      throw err
    })
  }
  return vad
}

/** Uygulama kapanırken arka plandaki ses programları da kapatılır */
export function disposeVoiceEngines(): void {
  whisper?.stop()
  piper?.stop()
  whisper = null
  piper = null
}
