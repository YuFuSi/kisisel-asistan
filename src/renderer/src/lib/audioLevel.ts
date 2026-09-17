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

type SpectrumSource = () => number[]

const spectrumSources: Record<LevelKind, Set<SpectrumSource>> = {
  input: new Set(),
  output: new Set()
}

/** Spektrum kaynağı ekler; dönen fonksiyon kaynağı kaldırır */
export function registerSpectrum(kind: LevelKind, source: SpectrumSource): () => void {
  spectrumSources[kind].add(source)
  return () => {
    spectrumSources[kind].delete(source)
  }
}

/** Kayıtlı ilk kaynağın bantlanmış seviyeleri; kaynak yoksa sıfır dizisi */
export function getAudioSpectrum(kind: LevelKind, bands: number): number[] {
  for (const source of spectrumSources[kind]) return source()
  return new Array(bands).fill(0)
}

/** Ham 0-255 frekans verisini `bands` sayıda 0-1 aralığına ortalanmış dilime böler */
export function binSpectrum(data: Uint8Array, bands: number): number[] {
  const bandSize = Math.floor(data.length / bands)
  const result: number[] = []
  for (let b = 0; b < bands; b++) {
    let sum = 0
    for (let i = 0; i < bandSize; i++) sum += data[b * bandSize + i]
    result.push(sum / bandSize / 255)
  }
  return result
}

/** AnalyserNode'un anlık frekans verisini bantlanmış seviyelere çevirir */
export function analyserSpectrum(analyser: AnalyserNode, bands: number): number[] {
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  return binSpectrum(data, bands)
}
