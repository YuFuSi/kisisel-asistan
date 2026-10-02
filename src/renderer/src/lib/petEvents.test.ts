import { afterEach, describe, expect, it } from 'vitest'
import { isPraise, onPetSignal, sendPetSignal } from './petEvents'

const unsubscribers: (() => void)[] = []

function subscribe(listener: (signal: 'praise') => void): void {
  unsubscribers.push(onPetSignal(listener))
}

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe())
})

describe('isPraise', () => {
  it.each(['Teşekkür ederim', 'Sağ ol', 'Aferin Jarvis', 'Seni seviyorum'])(
    'övücü ifadeyi tanır: %s',
    (text) => {
      expect(isPraise(text)).toBe(true)
    }
  )

  it('büyük ve küçük harfi ayırt etmez', () => {
    expect(isPraise('TEŞEKKÜR EDERİM')).toBe(true)
    expect(isPraise('SAĞ OL')).toBe(true)
  })

  it.each(['Bugün hava güzel', 'Bana hava durumunu söyle', ''])(
    'normal metni övgü saymaz: "%s"',
    (text) => {
      expect(isPraise(text)).toBe(false)
    }
  )
})

describe('pet sinyalleri', () => {
  it('gönderilen sinyali abone olanlara iletir', () => {
    const received: string[] = []
    subscribe((signal) => received.push(signal))

    sendPetSignal('praise')

    expect(received).toEqual(['praise'])
  })

  it('abonelikten çıkan dinleyiciye sinyal göndermez', () => {
    const received: string[] = []
    const unsubscribe = onPetSignal((signal) => received.push(signal))
    unsubscribers.push(unsubscribe)

    unsubscribe()
    sendPetSignal('praise')

    expect(received).toEqual([])
  })
})
