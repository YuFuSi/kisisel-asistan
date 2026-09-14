import { useSyncExternalStore } from 'react'
import type { VoiceEvent, VoicePackStatus, VoicePhase } from '@shared/api'
import { setSpeaking, setVoicePhase } from './assistantState'
import { analyserLevel, registerLevel } from './audioLevel'
import { errorMessage } from './errors'
import { pickVoice } from './voice'
import captureWorkletUrl from './voiceCaptureWorklet.ts?worker&url'

// Arayüz tarafında Jarvis sesi: ana sürecin sesli sohbet olaylarını dinler, mikrofonu açıp kapatır
// ve Jarvis'in cümlelerini sırayla çalar. Uygulama açılışında bir kez başlatılır (initVoiceClient).

export interface VoiceSnapshot {
  phase: VoicePhase
  sessionActive: boolean
  /** Son söylenen cümle (yazıya çevrilmiş) */
  userCaption: string | null
  /** Jarvis'in cevabı (seslendirildikçe uzar) */
  assistantCaption: string | null
  /** Sesli sohbetin kaydedildiği sohbet */
  conversationId: number | null
  error: string | null
  micError: string | null
  pack: VoicePackStatus | null
}

let snapshot: VoiceSnapshot = {
  phase: 'off',
  sessionActive: false,
  userCaption: null,
  assistantCaption: null,
  conversationId: null,
  error: null,
  micError: null,
  pack: null
}
const listeners = new Set<() => void>()

function update(patch: Partial<VoiceSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useVoice(): VoiceSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}

// ---- Mikrofon ----

interface MicState {
  stream: MediaStream
  context: AudioContext
  node: AudioWorkletNode
  unregisterLevel: () => void
}

let mic: MicState | null = null
let micStarting: Promise<void> | null = null
let lastLoggedMicError: string | null = null

function describeMicError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError') {
    return 'Mikrofon izni verilmedi. Windows ayarlarından uygulamalar için mikrofon erişimine izin ver.'
  }
  if (name === 'NotFoundError') return 'Mikrofon bulunamadı.'
  return `Mikrofon açılamadı: ${errorMessage(err)}`
}

function startMic(): Promise<void> {
  if (mic) return Promise.resolve()
  if (micStarting) return micStarting
  micStarting = (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      const context = new AudioContext()
      await context.audioWorklet.addModule(captureWorkletUrl)
      const source = context.createMediaStreamSource(stream)
      const node = new AudioWorkletNode(context, 'voice-capture')
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        window.api.voice.pushAudio(event.data)
      }
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      source.connect(node)
      // İşleyicinin çalışması için çıkışa bağlı olması gerekir; ses duyulmasın diye kazanç sıfır
      const mute = context.createGain()
      mute.gain.value = 0
      node.connect(mute).connect(context.destination)

      mic = {
        stream,
        context,
        node,
        unregisterLevel: registerLevel('input', () => analyserLevel(analyser))
      }
      update({ micError: null })
      // Açılırken dinleme kapatıldıysa mikrofon hemen bırakılır
      if (snapshot.phase === 'off') stopMic()
    } catch (err) {
      const message = describeMicError(err)
      update({ micError: message })
      // Aynı hata her dinleme denemesinde günlüğe tekrar yazılmasın
      if (message !== lastLoggedMicError) {
        lastLoggedMicError = message
        window.api.app.logError(`Jarvis mikrofonu açılamadı: ${message}`)
      }
    } finally {
      micStarting = null
    }
  })()
  return micStarting
}

function stopMic(): void {
  if (!mic) return
  const current = mic
  mic = null
  current.node.port.onmessage = null
  current.stream.getTracks().forEach((track) => track.stop())
  current.unregisterLevel()
  void current.context.close()
}

// ---- Jarvis'in sesini çalma ----

interface PlayItem {
  id: number
  audio: ArrayBuffer | null
  text: string
  voiceUri: string
}

const playQueue: PlayItem[] = []
let playing: { id: number; stop: () => void } | null = null
// Her durdurmada artar; durdurmadan önce başlayan (çözümlemesi süren) ses çalınmaz
let playToken = 0
let outputContext: AudioContext | null = null
let outputAnalyser: AnalyserNode | null = null

function outputNodes(): { context: AudioContext; analyser: AnalyserNode } {
  if (!outputContext || !outputAnalyser) {
    outputContext = new AudioContext()
    outputAnalyser = outputContext.createAnalyser()
    outputAnalyser.fftSize = 512
    outputAnalyser.connect(outputContext.destination)
    const analyser = outputAnalyser
    registerLevel('output', () => analyserLevel(analyser))
  }
  return { context: outputContext, analyser: outputAnalyser }
}

function playNext(): void {
  if (playing) return
  const item = playQueue.shift()
  if (!item) {
    setSpeaking(false)
    return
  }
  setSpeaking(true)
  const token = playToken
  const finish = (): void => {
    if (playing?.id !== item.id) return
    playing = null
    window.api.voice.playbackEnded(item.id)
    playNext()
  }

  if (item.audio) {
    const audio = item.audio
    playing = { id: item.id, stop: () => {} }
    void (async () => {
      try {
        const { context, analyser } = outputNodes()
        if (context.state === 'suspended') await context.resume()
        const buffer = await context.decodeAudioData(audio.slice(0))
        if (token !== playToken || playing?.id !== item.id) return
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(analyser)
        source.onended = finish
        playing = {
          id: item.id,
          stop: () => {
            source.onended = null
            try {
              source.stop()
            } catch {
              // Zaten bitmiş
            }
          }
        }
        source.start()
      } catch (err) {
        window.api.app.logError(`Jarvis sesi çalınamadı: ${errorMessage(err)}`)
        finish()
      }
    })()
    return
  }

  // Windows sesi (Piper kurulu değilse veya seçilmediyse)
  const synth = window.speechSynthesis
  if (!synth) {
    playing = { id: item.id, stop: () => {} }
    finish()
    return
  }
  const utterance = new SpeechSynthesisUtterance(item.text)
  const voice = pickVoice(synth.getVoices(), item.voiceUri)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'tr-TR'
  }
  utterance.onend = finish
  utterance.onerror = finish
  playing = {
    id: item.id,
    stop: () => {
      utterance.onend = null
      utterance.onerror = null
      synth.cancel()
    }
  }
  synth.speak(utterance)
}

function stopPlayback(): void {
  playToken++
  playQueue.length = 0
  const current = playing
  playing = null
  current?.stop()
  setSpeaking(false)
}

/** Jarvis uyanınca kısa, yükselen iki notalı bir ses */
function playChime(): void {
  try {
    const context = new AudioContext()
    const now = context.currentTime
    ;[660, 990].forEach((frequency, i) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = now + i * 0.11
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.18)
    })
    setTimeout(() => void context.close(), 600)
  } catch {
    // Ses çalınamasa da dinleme sürer
  }
}

// ---- Olaylar ----

function applyPhase(phase: VoicePhase, sessionActive: boolean): void {
  update({ phase, sessionActive })
  setVoicePhase(phase)
  if (phase === 'off') stopMic()
  else void startMic()
}

function handleEvent(event: VoiceEvent): void {
  switch (event.type) {
    case 'pack':
      update({ pack: event.status })
      break
    case 'phase':
      applyPhase(event.phase, event.sessionActive)
      break
    case 'wake':
      playChime()
      update({ userCaption: null, assistantCaption: null, error: null })
      break
    case 'caption':
      if (event.role === 'user') {
        update({
          userCaption: event.text,
          assistantCaption: null,
          conversationId: event.conversationId
        })
      } else {
        update({ assistantCaption: event.text, conversationId: event.conversationId })
      }
      break
    case 'play':
      playQueue.push({
        id: event.id,
        audio: event.audio,
        text: event.text,
        voiceUri: event.voiceUri
      })
      playNext()
      break
    case 'stop-playback':
      stopPlayback()
      break
    case 'error':
      update({ error: event.message })
      break
  }
}

let initialized = false

export function initVoiceClient(): void {
  if (initialized) return
  initialized = true
  window.api.voice.onEvent(handleEvent)
  window.api.voice.state().then(
    (state) => applyPhase(state.phase, state.sessionActive),
    () => {}
  )
  window.api.voice.packStatus().then(
    (pack) => update({ pack }),
    () => {}
  )
}

/** Küreye dokununca: konuşma sürüyorsa bitir, değilse dinlemeye başla */
export function toggleVoiceSession(): void {
  update({ error: null })
  if (snapshot.sessionActive) void window.api.voice.stopSession()
  else void window.api.voice.startTurn()
}
