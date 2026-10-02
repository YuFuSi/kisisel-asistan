export interface BabbleOptions {
  volume: number
  pitch?: number
  speed?: number
  /** Ses kapalı tercihinde false gönderilir; hareket tercihi sesi değiştirmez. */
  enabled?: boolean
}

export interface BabbleNote {
  at: number
  duration: number
  frequency: number
  energy: number
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback))
}

/** Türkçe seslilerde veya üç harfte böl; boşluk ve noktalama ayrı sessizliklerdir. */
export function splitBabble(text: string): string[] {
  const groups: string[] = []
  let group = ''
  for (const letter of Array.from(text.normalize('NFC'))) {
    if (!/\p{L}|\p{N}/u.test(letter)) {
      if (group) groups.push(group)
      group = ''
      groups.push(letter)
    } else {
      group += letter
      if (/[aeıioöuü]/iu.test(letter) || group.length >= 3) {
        groups.push(group)
        group = ''
      }
    }
  }
  if (group) groups.push(group)
  return groups
}

/** Aynı metin ve sıra aynı perdeyi verir; rastgelelik veya saat kullanılmaz. */
export function babbleFrequency(text: string, index: number, pitch = 1): number {
  let hash = 2166136261
  for (const letter of text.normalize('NFC')) {
    hash = Math.imul(hash ^ letter.codePointAt(0)!, 16777619)
  }
  hash = Math.imul(hash ^ index, 16777619) >>> 0
  return clamp((240 + (hash % 241)) * clamp(pitch, 0.5, 2, 1), 180, 600, 320)
}

/** Süre saniye cinsinden; uzun metin dört saniyelik kısa bir mırıltıya dönüşür. */
export function planBabble(text: string, pitch = 1, speed = 1): BabbleNote[] {
  const notes: BabbleNote[] = []
  const duration = clamp(0.055 / clamp(speed, 0.5, 2, 1), 0.04, 0.07, 0.055)
  let at = 0
  for (const group of splitBabble(text)) {
    if (at + duration > 4) break
    if (/^[\p{L}\p{N}]/u.test(group)) {
      notes.push({ at, duration, frequency: babbleFrequency(text, notes.length, pitch), energy: 1 })
      at += duration + 0.012
    } else {
      // Art arda boşluklar da birikerek dört saniye sınırını aşamaz.
      at += /\s/u.test(group) ? 0.025 : 0.05
    }
  }
  const ending = text.trimEnd().slice(-1)
  if (ending === '?') {
    for (const note of notes.slice(-3)) note.frequency = Math.min(600, note.frequency * 1.22)
    if (notes.length > 1) {
      const last = notes[notes.length - 1]
      last.frequency = Math.min(
        600,
        Math.max(last.frequency, notes[notes.length - 2].frequency + 45)
      )
    }
  } else if (ending === '!') {
    for (const note of notes) note.energy = 1.25
  }
  return notes
}

/** Bağımsız robot sesi: stop ve doğal bitiş tüm ses düğümlerini kapatır. */
export function speakBabble(
  text: string,
  { volume, pitch = 1, speed = 1, enabled = true }: BabbleOptions
): { stop(): void; done: Promise<void> } {
  let resolveDone!: () => void
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  let context: AudioContext | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const nodes: { oscillator: OscillatorNode; gain: GainNode }[] = []
  let finished = false
  const stop = (): void => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    for (const { oscillator, gain } of nodes) {
      oscillator.onended = null
      try {
        oscillator.stop()
      } catch {
        /* Zaten bitmiş olabilir. */
      }
      oscillator.disconnect()
      gain.disconnect()
    }
    if (context) void context.close().catch(() => undefined)
    resolveDone()
  }
  const level = clamp(volume, 0, 1, 0)
  const notes = enabled && level > 0 ? planBabble(text, pitch, speed) : []
  if (!notes.length) {
    stop()
    return { stop, done }
  }
  try {
    context = new AudioContext()
    const ctx = context
    // Kullanıcı etkileşimi yoksa resume bekleyebilir; kaynaklar süresiz açık kalmasın.
    timer = setTimeout(stop, 5000)
    void (async (): Promise<void> => {
      try {
        if (ctx.state === 'suspended') await ctx.resume()
        if (finished) return
        const start = ctx.currentTime + 0.01
        for (const [index, note] of notes.entries()) {
          const oscillator = ctx.createOscillator()
          const gain = ctx.createGain()
          nodes.push({ oscillator, gain })
          oscillator.type = index % 3 === 0 ? 'square' : 'triangle'
          oscillator.frequency.value = note.frequency
          const at = start + note.at
          gain.gain.setValueAtTime(0, at)
          gain.gain.linearRampToValueAtTime(level * 0.08 * note.energy, at + 0.008)
          gain.gain.linearRampToValueAtTime(0, at + note.duration)
          oscillator.connect(gain).connect(ctx.destination)
          if (index === notes.length - 1) oscillator.onended = stop
          oscillator.start(at)
          oscillator.stop(at + note.duration)
        }
        clearTimeout(timer)
        const last = notes[notes.length - 1]
        timer = setTimeout(stop, (last.at + last.duration + 0.1) * 1000)
      } catch {
        stop()
      }
    })()
  } catch {
    stop()
  }
  return { stop, done }
}
