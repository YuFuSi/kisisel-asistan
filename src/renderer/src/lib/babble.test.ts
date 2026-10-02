import { afterEach, describe, expect, it, vi } from 'vitest'
import { babbleFrequency, planBabble, speakBabble, splitBabble } from './babble'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('robot dili planı', () => {
  it('Türkçe harfleri korur, boşluk/noktalama ayrı gruplardır', () => {
    expect(splitBabble('Merhaba, ışık!')).toEqual([
      'Me',
      'rha',
      'ba',
      ',',
      ' ',
      'ı',
      'şı',
      'k',
      '!'
    ])
    expect(splitBabble('')).toEqual([])
    expect(splitBabble('şşşş')).toEqual(['şşş', 'ş'])
  })

  it('aynı metin aynı melodidir, değişen metnin melodisi değişir', () => {
    expect(planBabble('Merhaba Jarvis')).toEqual(planBabble('Merhaba Jarvis'))
    expect(babbleFrequency('Merhaba', 0)).not.toBe(babbleFrequency('Günaydın', 0))
    expect(babbleFrequency('ş', 0)).toBe(babbleFrequency('s\u0327', 0))
  })

  it('perde ve hız geçersiz ya da uç değerlerde de sınırda kalır', () => {
    for (const pitch of [0, 100, -1, NaN, Infinity]) {
      for (let index = 0; index < 20; index++) {
        const frequency = babbleFrequency('Jarvis!', index, pitch)
        expect(frequency).toBeGreaterThanOrEqual(180)
        expect(frequency).toBeLessThanOrEqual(600)
      }
    }
    for (const speed of [0, 100, NaN]) {
      for (const note of planBabble('Uzun bir örnek', 1, speed)) {
        expect(note.duration).toBeGreaterThanOrEqual(0.04)
        expect(note.duration).toBeLessThanOrEqual(0.07)
      }
    }
  })

  it('soruyu yükseltir, ünlemi daha enerjik çalar ve sessizlik bırakır', () => {
    const normal = planBabble('Merhaba')
    const question = planBabble('Merhaba?')
    expect(question.at(-1)!.frequency).toBeGreaterThan(normal.at(-1)!.frequency)
    expect(question.at(-1)!.frequency).toBeGreaterThan(question.at(-2)!.frequency)
    expect(planBabble('Merhaba!')[0].energy).toBeGreaterThan(normal[0].energy)
    expect(planBabble('a a')[1].at).toBeGreaterThan(planBabble('aa')[1].at)
    expect(planBabble('a,a')[1].at).toBeGreaterThan(planBabble('a a')[1].at)
  })

  it('uzun metni dört saniye ile sınırlar ve hız süreyi etkiler', () => {
    const notes = planBabble('Merhaba dünya! '.repeat(1000))
    expect(notes.at(-1)!.at + notes.at(-1)!.duration).toBeLessThanOrEqual(4)
    expect(notes.length).toBeLessThan(100)
    expect(planBabble('Merhaba dünya', 1, 2).at(-1)!.at).toBeLessThan(
      planBabble('Merhaba dünya').at(-1)!.at
    )
    expect(planBabble('... ')).toEqual([])
  })
})

function mockAudio(
  suspended = false,
  resumeFailure = false
): {
  context: { close: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> }
  oscillators: {
    onended: (() => void) | null
    stop: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }[]
  gains: { disconnect: ReturnType<typeof vi.fn> }[]
} {
  const oscillators: ReturnType<typeof mockAudio>['oscillators'] = []
  const gains: ReturnType<typeof mockAudio>['gains'] = []
  const context = {
    state: suspended ? 'suspended' : 'running',
    currentTime: 0,
    destination: {},
    close: vi.fn().mockResolvedValue(undefined),
    resume: vi
      .fn()
      .mockImplementation(() =>
        resumeFailure ? Promise.reject(new Error('kapalı')) : Promise.resolve()
      ),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: '',
        frequency: { value: 0 },
        onended: null as (() => void) | null,
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        connect: vi.fn()
      }
      oscillator.connect.mockImplementation((gain) => gain)
      oscillators.push(oscillator)
      return oscillator
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      gains.push(gain)
      return gain
    })
  }
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return context
      }
    }
  )
  return { context, oscillators, gains }
}

describe('ses yaşam döngüsü', () => {
  it('kapalı/sıfır ses veya boş metinde AudioContext oluşturmaz', async () => {
    const constructor = vi.fn()
    vi.stubGlobal('AudioContext', constructor)
    for (const [text, options] of [
      ['Merhaba', { volume: 1, enabled: false }],
      ['Merhaba', { volume: 0 }],
      ['', { volume: 1 }]
    ] as const) {
      await speakBabble(text, options).done
    }
    expect(constructor).not.toHaveBeenCalled()
  })

  it('stop tekrar çağrılsa da düğümler ve zamanlayıcı bir kez temizlenir', async () => {
    vi.useFakeTimers()
    const { context, oscillators, gains } = mockAudio()
    const speech = speakBabble('Merhaba', { volume: 0.5 })
    speech.stop()
    speech.stop()
    await speech.done
    expect(context.close).toHaveBeenCalledTimes(1)
    expect(oscillators.length).toBeGreaterThan(0)
    for (const oscillator of oscillators) {
      expect(oscillator.disconnect).toHaveBeenCalledOnce()
      expect(oscillator.onended).toBeNull()
    }
    for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('doğal bitiş ve başarısız resume done sözünü çözer', async () => {
    vi.useFakeTimers()
    const audio = mockAudio()
    const speech = speakBabble('Selam', { volume: 1 })
    audio.oscillators.at(-1)!.onended!()
    await speech.done
    expect(audio.context.close).toHaveBeenCalledOnce()
    const failed = mockAudio(true, true)
    await speakBabble('Selam', { volume: 1 }).done
    expect(failed.context.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resume beklerken durdurma sonradan ses başlatmaz', async () => {
    vi.useFakeTimers()
    const audio = mockAudio(true)
    const speech = speakBabble('Selam', { volume: 1 })
    speech.stop()
    await speech.done
    expect(audio.oscillators).toHaveLength(0)
    expect(audio.context.close).toHaveBeenCalledOnce()
  })

  it('onended gelmese de güvenlik zamanlayıcısı kaynakları kapatır', async () => {
    vi.useFakeTimers()
    const audio = mockAudio()
    const speech = speakBabble('Selam', { volume: 1 })
    await vi.runAllTimersAsync()
    await speech.done
    expect(audio.context.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
