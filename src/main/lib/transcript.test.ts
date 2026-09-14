import { describe, expect, it } from 'vitest'
import { cleanTranscript } from './transcript'

describe('cleanTranscript', () => {
  it('işaretleri ve fazla boşlukları temizler', () => {
    expect(cleanTranscript(' [BLANK_AUDIO]  Yarın saat dokuzda (müzik) toplantım var. ')).toBe(
      'Yarın saat dokuzda toplantım var.'
    )
  })

  it('sadece işaret veya noktalama kaldıysa boş döner', () => {
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('')
    expect(cleanTranscript(' ... ')).toBe('')
  })

  it('kısa uydurma altyazı cümlelerini atar', () => {
    expect(cleanTranscript('Altyazı M.K.')).toBe('')
    expect(cleanTranscript('İzlediğiniz için teşekkür ederim.')).toBe('')
    expect(cleanTranscript('Teşekkürler.')).toBe('')
  })

  it('uzun gerçek cümledeki benzer kelimeleri silmez', () => {
    const text = 'Dün izlediğim filmin altyazısı çok kötüydü, bunu not olarak kaydet lütfen.'
    expect(cleanTranscript(text)).toBe(text)
    expect(cleanTranscript('Teşekkürler, şimdi yarınki görevlerimi listele')).toBe(
      'Teşekkürler, şimdi yarınki görevlerimi listele'
    )
  })
})
