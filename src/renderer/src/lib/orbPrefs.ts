import { useSyncExternalStore } from 'react'

// Kürenin renk teması ve yoğunluğu: sadece bu bilgisayardaki görünüm tercihi olduğu için tarayıcı deposunda tutulur
export interface OrbTheme {
  id: string
  label: string
  /** Taban tona eklenen kayma (derece) */
  hue: number
  /** Ayarlar'daki renk örneği */
  swatch: string
}

export const ORB_THEMES: OrbTheme[] = [
  { id: 'indigo', label: 'Çivit', hue: 0, swatch: 'hsl(231, 72%, 62%)' },
  { id: 'ocean', label: 'Okyanus', hue: -38, swatch: 'hsl(193, 72%, 55%)' },
  { id: 'forest', label: 'Orman', hue: -92, swatch: 'hsl(139, 72%, 50%)' },
  { id: 'amber', label: 'Kehribar', hue: 170, swatch: 'hsl(41, 72%, 58%)' },
  { id: 'rose', label: 'Gül', hue: 105, swatch: 'hsl(336, 72%, 64%)' }
]

export interface OrbIntensity {
  id: string
  label: string
  /** İç sis parlaklığı ve akış hızı çarpanı */
  factor: number
}

export const ORB_INTENSITIES: OrbIntensity[] = [
  { id: 'calm', label: 'Sakin', factor: 0.6 },
  { id: 'balanced', label: 'Dengeli', factor: 1 },
  { id: 'vivid', label: 'Canlı', factor: 1.45 }
]

export interface OrbPrefs {
  theme: string
  intensity: string
  /** Kürede ışıktan gözler (yüz) gösterilsin mi */
  face: boolean
}

const KEY = 'orbPrefs'
const DEFAULTS: OrbPrefs = { theme: 'indigo', intensity: 'balanced', face: true }

function load(): OrbPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<OrbPrefs>
    return {
      theme: ORB_THEMES.some((t) => t.id === parsed.theme) ? String(parsed.theme) : DEFAULTS.theme,
      intensity: ORB_INTENSITIES.some((i) => i.id === parsed.intensity)
        ? String(parsed.intensity)
        : DEFAULTS.intensity,
      face: typeof parsed.face === 'boolean' ? parsed.face : DEFAULTS.face
    }
  } catch {
    return DEFAULTS
  }
}

let prefs: OrbPrefs = load()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

// Çentik penceresi ayrı bir sayfa: orada yapılan değişiklik buraya da gelsin
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return
  prefs = load()
  emit()
})

export function getOrbPrefs(): OrbPrefs {
  return prefs
}

export function setOrbPrefs(patch: Partial<OrbPrefs>): void {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Depo kapalıysa tercih sadece bu oturumda geçerli olur
  }
  emit()
}

/** Seçili temanın ton kayması ve yoğunluk çarpanı */
export function orbLook(): { hue: number; factor: number } {
  const theme = ORB_THEMES.find((t) => t.id === prefs.theme) ?? ORB_THEMES[0]
  const intensity = ORB_INTENSITIES.find((i) => i.id === prefs.intensity) ?? ORB_INTENSITIES[1]
  return { hue: theme.hue, factor: intensity.factor }
}

export function useOrbPrefs(): OrbPrefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => prefs
  )
}
