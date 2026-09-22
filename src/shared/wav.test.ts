import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav, normalizeGain, resample } from './wav'

describe('WAV', () => {
  it('kodlanan sesi aynı değerlerle geri çözer', () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.25])
    const buffer = encodeWav(samples, 16000)
    expect(buffer.byteLength).toBe(44 + samples.length * 2)

    const decoded = decodeWav(buffer)
    expect(decoded.sampleRate).toBe(16000)
    expect(decoded.samples).toHaveLength(samples.length)
    decoded.samples.forEach((value, i) => expect(value).toBeCloseTo(samples[i], 3))
  })

  it('WAV olmayan veride hata verir', () => {
    expect(() => decodeWav(new ArrayBuffer(100))).toThrow('Geçersiz WAV')
  })

  it('yeniden örneklemede uzunluk orana göre değişir', () => {
    const samples = new Float32Array(22050).fill(0.3)
    const result = resample(samples, 22050, 16000)
    expect(result).toHaveLength(16000)
    expect(result[8000]).toBeCloseTo(0.3)
    expect(resample(samples, 16000, 16000)).toBe(samples)
  })
})

describe('normalizeGain', () => {
  it('kısık sesi hedef tepe genliğine yükseltir', () => {
    const samples = Float32Array.from([0, 0.01, -0.01, 0.005])
    const result = normalizeGain(samples, 0.89, 100)
    expect(Math.max(...Array.from(result).map(Math.abs))).toBeCloseTo(0.89, 2)
  })

  it('kazancı üst sınırla sınırlar (gürültüyü aşırı yükseltmez)', () => {
    const samples = Float32Array.from([0, 0.0001, -0.0001])
    const result = normalizeGain(samples, 0.89, 12)
    expect(result[1]).toBeCloseTo(0.0001 * 12, 6)
  })

  it('tam sessizlikte dokunmaz', () => {
    const samples = new Float32Array(4)
    expect(normalizeGain(samples)).toBe(samples)
  })

  it('zaten yeterince güçlü sesi değiştirmez', () => {
    const samples = Float32Array.from([0, 0.9, -0.9])
    expect(normalizeGain(samples, 0.89)).toBe(samples)
  })
})
