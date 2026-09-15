import { describe, expect, it } from 'vitest'
import { audioContextFor } from './whisper'

// 16 kHz, 16 bit tek kanallı WAV: saniyede 32 000 bayt + 44 bayt başlık
const wavOf = (seconds: number): ArrayBuffer => new ArrayBuffer(44 + Math.round(seconds * 32000))

describe('audioContextFor', () => {
  it('kısa seste pencereyi en az 512 karede tutar', () => {
    expect(audioContextFor(wavOf(0))).toBe(512)
    expect(audioContextFor(wavOf(3))).toBe(512)
  })

  it('uzun seste pencereyi sesin süresine göre büyütür (kare başına 20 ms + pay)', () => {
    // 12 sn → 600 kare + 64 pay
    expect(audioContextFor(wavOf(12))).toBe(664)
  })

  it('30 saniyeyi aşan seste tam pencereyi (1500) geçmez', () => {
    expect(audioContextFor(wavOf(45))).toBe(1500)
  })
})
