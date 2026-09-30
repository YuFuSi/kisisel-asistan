import { useSyncExternalStore } from 'react'

// Küre ses efektleri: ses dosyası yok, hepsi WebAudio ile anında üretilir. Sadece bu bilgisayardaki tercih (tarayıcı deposu).
export type Sfx = 'done' | 'error' | 'approval' | 'notice' | 'tap'

interface Note {
  /** Hz */
  freq: number
  /** Saniye cinsinden başlangıç gecikmesi */
  at: number
  /** Saniye cinsinden süre */
  length: number
  /** 0-1 göreli ses */
  gain: number
  type?: OscillatorType
}

// Kısa ve yumuşak: hepsi 0,5 sn'den kısa, sessiz seviyede
const SOUNDS: Record<Sfx, Note[]> = {
  // Yükselen üç nota: iş tamam
  done: [
    { freq: 523, at: 0, length: 0.14, gain: 0.7 },
    { freq: 659, at: 0.09, length: 0.14, gain: 0.7 },
    { freq: 784, at: 0.18, length: 0.24, gain: 0.8 }
  ],
  // Alçalan iki tok nota: hata
  error: [
    { freq: 262, at: 0, length: 0.18, gain: 0.8, type: 'triangle' },
    { freq: 196, at: 0.14, length: 0.26, gain: 0.8, type: 'triangle' }
  ],
  // Soru sorar gibi yükselen iki nota: onay bekliyor
  approval: [
    { freq: 440, at: 0, length: 0.12, gain: 0.6 },
    { freq: 587, at: 0.14, length: 0.2, gain: 0.7 }
  ],
  // Tek yumuşak nota: bildirim
  notice: [{ freq: 880, at: 0, length: 0.3, gain: 0.5 }],
  // Çok kısa tık: küreye dokunma
  tap: [{ freq: 1200, at: 0, length: 0.05, gain: 0.35 }]
}

const MASTER_GAIN = 0.16
const KEY = 'sfxEnabled'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = load()
const listeners = new Set<() => void>()

export function setSfxEnabled(value: boolean): void {
  enabled = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {
    // Depo kapalıysa tercih sadece bu oturumda geçerli olur
  }
  listeners.forEach((listener) => listener())
}

export function useSfxEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => enabled
  )
}

let context: AudioContext | null = null

// Çentik de ana pencerenin olaylarını dinliyor; aynı efekt iki kez çalmasın diye
// o sadece kendi dokunma sesini çalar
const auxiliaryWindow = window.location.hash === '#notch'

/** Ses efektini çalar; kapalıysa, hareket azaltma açıksa veya ses çalınamıyorsa sessizce çıkar */
export function playSfx(kind: Sfx): void {
  if (!enabled || (auxiliaryWindow && kind !== 'tap')) return
  try {
    context ??= new AudioContext()
    const ctx = context
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    for (const note of SOUNDS[kind]) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = note.type ?? 'sine'
      oscillator.frequency.value = note.freq
      const start = now + note.at
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(MASTER_GAIN * note.gain, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0008, start + note.length)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + note.length + 0.02)
    }
  } catch {
    // Ses çalınamasa da uygulama etkilenmez
  }
}
