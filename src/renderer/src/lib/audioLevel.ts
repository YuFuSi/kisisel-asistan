// Mikrofon (giriş) ve Jarvis'in sesi (çıkış) için anlık ses seviyesi. Jarvis küresi buna göre titreşir.

type LevelSource = () => number
export type LevelKind = 'input' | 'output'

const sources: Record<LevelKind, Set<LevelSource>> = {
  input: new Set(),
  output: new Set()
}

/** Seviye kaynağı ekler; dönen fonksiyon kaynağı kaldırır */
export function registerLevel(kind: LevelKind, source: LevelSource): () => void {
  sources[kind].add(source)
  return () => {
    sources[kind].delete(source)
  }
}

/** 0-1 arası en yüksek seviye; kaynak yoksa 0 */
export function getAudioLevel(kind: LevelKind): number {
  let level = 0
  for (const source of sources[kind]) level = Math.max(level, source())
  return level
}

/** AnalyserNode'daki sesin gücü (RMS), konuşma seviyesinde 0-1 aralığına ölçeklenmiş */
export function analyserLevel(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(samples)
  let sum = 0
  for (const sample of samples) {
    const value = (sample - 128) / 128
    sum += value * value
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}
