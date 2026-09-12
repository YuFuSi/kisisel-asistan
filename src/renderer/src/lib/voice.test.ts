import { describe, expect, it } from 'vitest'
import { listVoiceOptions, pickVoice, plainForSpeech } from './voice'

const voice = (name: string, lang: string): SpeechSynthesisVoice =>
  ({ name, lang, voiceURI: `${name}-uri` }) as SpeechSynthesisVoice

const voices = [voice('David', 'en-US'), voice('Tolga', 'tr-TR'), voice('Zira', 'en-US')]

describe('pickVoice', () => {
  it('seçili sesi kullanır', () => {
    expect(pickVoice(voices, 'Zira-uri')?.name).toBe('Zira')
  })

  it('seçim yoksa veya bulunamazsa Türkçe sesi seçer', () => {
    expect(pickVoice(voices, '')?.name).toBe('Tolga')
    expect(pickVoice(voices, 'olmayan-uri')?.name).toBe('Tolga')
  })

  it('Türkçe ses yoksa ilk sesi seçer, hiç ses yoksa undefined döner', () => {
    expect(pickVoice([voice('David', 'en-US')], '')?.name).toBe('David')
    expect(pickVoice([], '')).toBeUndefined()
  })
})

describe('listVoiceOptions', () => {
  it('Türkçe sesleri başa alır', () => {
    expect(listVoiceOptions(voices)[0].label).toBe('Tolga (tr-TR)')
  })
})

describe('plainForSpeech', () => {
  it('Markdown işaretlerini temizler', () => {
    expect(plainForSpeech('**Kalın** ve *eğik* yazı')).toBe('Kalın ve eğik yazı')
    expect(plainForSpeech('## Başlık\n\nMetin')).toBe('Başlık. Metin')
    expect(plainForSpeech('- madde bir\n- madde iki')).toBe('madde bir madde iki')
  })

  it('bağlantıları ve kod bloklarını okunur hale getirir', () => {
    expect(plainForSpeech('[Google](https://google.com) adresi')).toBe('Google adresi')
    expect(plainForSpeech('Şuna bak:\n```js\nconst a = 1\n```')).toBe('Şuna bak: kod bloğu')
  })
})
