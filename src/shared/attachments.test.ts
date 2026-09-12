import { describe, expect, it } from 'vitest'
import { composeMessage, formatAttachment, splitAttachments, toModelContent } from './attachments'
import type { AttachedDocument } from './api'

const rapor: AttachedDocument = {
  name: 'rapor.pdf',
  path: 'C:/Belgeler/rapor.pdf',
  text: 'Satışlar arttı.',
  partCount: 1,
  charCount: 15
}

describe('formatAttachment', () => {
  it('tek parçalı belgede devam notu eklemez', () => {
    const block = formatAttachment(rapor)
    expect(block).toContain('[[BELGE ad="rapor.pdf" parca="1/1"]]')
    expect(block).toContain('Satışlar arttı.')
    expect(block).not.toContain('belge_oku')
  })

  it('çok parçalı belgede modele devamını nasıl okuyacağını söyler', () => {
    const block = formatAttachment({ ...rapor, partCount: 3, charCount: 20000 })
    expect(block).toContain('parca="1/3"')
    expect(block).toContain('belge_oku')
  })

  it('addaki tırnak ve satır sonu etiketi bozmaz', () => {
    const block = formatAttachment({ ...rapor, name: 'a"b\nc.txt' })
    expect(block).toContain('ad="a\'b\'c.txt"')
  })
})

describe('composeMessage ve splitAttachments', () => {
  it('metin ve belgeleri birleştirip geri ayırır', () => {
    const notlar = { ...rapor, name: 'notlar.txt', text: 'Toplantı notları', partCount: 2 }
    const message = composeMessage('  Bunları özetle  ', [rapor, notlar])

    const { text, documents } = splitAttachments(message)
    expect(text).toBe('Bunları özetle')
    expect(documents).toEqual([
      { name: 'rapor.pdf', partCount: 1 },
      { name: 'notlar.txt', partCount: 2 }
    ])
  })

  it('belgesiz mesajı olduğu gibi bırakır', () => {
    expect(splitAttachments('Merhaba')).toEqual({ text: 'Merhaba', documents: [] })
  })
})

describe('toModelContent', () => {
  it('belgesiz mesajı değiştirmez', () => {
    expect(toModelContent('Merhaba')).toBe('Merhaba')
  })

  it('önce belgeyi, en sonda kullanıcının isteğini koyar', () => {
    const content = toModelContent(composeMessage('Kira ne kadar?', [rapor]))

    expect(content).toContain('tekrar yazma')
    expect(content).toContain('<belge ad="rapor.pdf" parca="1/1">')
    expect(content).toContain('Satışlar arttı.')
    expect(content).not.toContain('[[BELGE')
    expect(content.trimEnd().endsWith('Kullanıcının isteği: Kira ne kadar?')).toBe(true)
    expect(content.indexOf('<belge')).toBeLessThan(content.indexOf('Kullanıcının isteği'))
    // Tek parçalı belgede "devamını oku" notu yok
    expect(content).not.toContain('parçasından sadece 1. parçası')
  })

  it('çok parçalı belgede devamını okuma notunu isteğin hemen önüne koyar', () => {
    const content = toModelContent(
      composeMessage('Sonunda ne yazıyor?', [{ ...rapor, partCount: 4, charCount: 30000 }])
    )
    const note = content.indexOf('4 parçasından sadece 1. parçası')
    expect(note).toBeGreaterThan(content.indexOf('</belge>'))
    expect(note).toBeLessThan(content.indexOf('Kullanıcının isteği'))
    expect(content).toContain('belge_oku')
  })
})
