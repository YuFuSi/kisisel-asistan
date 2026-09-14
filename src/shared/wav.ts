// 16 bit PCM WAV kodlama/çözme. Hem ana süreçte hem arayüzde kullanılır (Node'a veya DOM'a bağlı değil).

export interface DecodedWav {
  sampleRate: number
  /** -1..1 arası, tek kanal (çok kanallıysa kanalların ortalaması) */
  samples: Float32Array
}

/** -1..1 arası örnekleri tek kanallı 16 bit WAV dosyasına çevirir */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // tek kanal
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
  }
  return buffer
}

/** 16 bit PCM WAV dosyasını çözer; başka biçimde hata fırlatır */
export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer)
  const text = (offset: number): string => String.fromCharCode(...new Uint8Array(buffer, offset, 4))
  if (buffer.byteLength < 44 || text(0) !== 'RIFF' || text(8) !== 'WAVE') {
    throw new Error('Geçersiz WAV dosyası.')
  }

  let offset = 12
  let channels = 1
  let sampleRate = 16000
  let bits = 16
  while (offset + 8 <= buffer.byteLength) {
    const id = text(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== 1) throw new Error('Sadece PCM WAV destekleniyor.')
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
    } else if (id === 'data') {
      if (bits !== 16) throw new Error('Sadece 16 bit WAV destekleniyor.')
      const frames = Math.floor(Math.min(size, buffer.byteLength - body) / (2 * channels))
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        let sum = 0
        for (let c = 0; c < channels; c++) sum += view.getInt16(body + (i * channels + c) * 2, true)
        samples[i] = sum / channels / 0x8000
      }
      return { sampleRate, samples }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('WAV dosyasında ses verisi bulunamadı.')
}

/** Doğrusal yeniden örnekleme (ör. Piper'ın 22050 Hz sesini 16000 Hz'e) */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const length = Math.round((samples.length * to) / from)
  const result = new Float32Array(length)
  const ratio = from / to
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, samples.length - 1)
    const fraction = position - index
    result[i] = samples[index] * (1 - fraction) + samples[next] * fraction
  }
  return result
}
