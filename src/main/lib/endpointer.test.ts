import { describe, expect, it } from 'vitest'
import { DEFAULT_ENDPOINTER, Endpointer, type EndpointResult } from './endpointer'

// 16 kHz'de 512 örnek = 32 ms
const FRAME = DEFAULT_ENDPOINTER.frameSamples
const frame = (value: number): Float32Array => new Float32Array(FRAME).fill(value)
const frames = (ms: number): number => Math.ceil(ms / 32)

function feed(
  endpointer: Endpointer,
  count: number,
  probability: number,
  value = 0
): EndpointResult {
  let result: EndpointResult = { type: 'waiting' }
  for (let i = 0; i < count; i++) {
    result = endpointer.push(frame(value), probability)
    if (result.type === 'done' || result.type === 'timeout') return result
  }
  return result
}

describe('Endpointer', () => {
  it('kısa gürültüyü konuşma saymaz', () => {
    const endpointer = new Endpointer()
    expect(feed(endpointer, 2, 0.9).type).toBe('waiting')
    expect(feed(endpointer, 1, 0.1).type).toBe('waiting')
    expect(endpointer.isSpeaking).toBe(false)
  })

  it('konuşmayı ön kayıtla birlikte yakalar ve sessizlikte bitirir', () => {
    const endpointer = new Endpointer()
    feed(endpointer, frames(500), 0.05, 0.01)
    expect(feed(endpointer, frames(1000), 0.9, 0.5).type).toBe('speaking')
    const result = feed(endpointer, frames(1000), 0.05, 0.02)

    expect(result.type).toBe('done')
    if (result.type !== 'done') return
    const seconds = result.audio.length / 16000
    // ~1 sn konuşma + ~0,3 sn ön kayıt + ~0,25 sn son sessizlik
    expect(seconds).toBeGreaterThan(1.2)
    expect(seconds).toBeLessThan(1.8)
    // Ön kayıt sessizlikten başlar, ortası konuşma
    expect(result.audio[0]).toBeCloseTo(0.01)
    expect(result.audio[Math.floor(result.audio.length / 2)]).toBeCloseTo(0.5)
    expect(endpointer.isSpeaking).toBe(false)
  })

  it('kelime aralarındaki kısa düşüşlerde bitirmez', () => {
    const endpointer = new Endpointer()
    feed(endpointer, frames(300), 0.9)
    expect(feed(endpointer, frames(300), 0.2).type).toBe('speaking')
    expect(feed(endpointer, frames(300), 0.4).type).toBe('speaking')
  })

  it('hiç konuşulmazsa zaman aşımı verir', () => {
    const endpointer = new Endpointer({ ...DEFAULT_ENDPOINTER, noSpeechTimeoutMs: 1000 })
    expect(feed(endpointer, frames(1200), 0.1).type).toBe('timeout')
  })

  it('en uzun süreyi aşan konuşmayı keser', () => {
    const endpointer = new Endpointer({ ...DEFAULT_ENDPOINTER, maxSpeechMs: 2000 })
    expect(feed(endpointer, frames(3000), 0.95).type).toBe('done')
  })
})
