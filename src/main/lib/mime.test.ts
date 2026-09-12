import { describe, expect, it } from 'vitest'
import { buildMimeMessage, buildRawMessage, encodeHeaderValue, isValidEmail } from './mime'

describe('encodeHeaderValue', () => {
  it('ASCII başlıkları olduğu gibi bırakır', () => {
    expect(encodeHeaderValue('Meeting notes')).toBe('Meeting notes')
  })

  it('Türkçe karakterli başlıkları kodlar', () => {
    const encoded = encodeHeaderValue('Yarınki toplantı')
    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true)
    const base64 = encoded.slice('=?UTF-8?B?'.length, -2)
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe('Yarınki toplantı')
  })

  it('satır sonlarını temizler (başlık enjeksiyonunu önler)', () => {
    expect(encodeHeaderValue('konu\r\nBcc: kotu@example.com')).toBe('konu Bcc: kotu@example.com')
  })
})

describe('buildMimeMessage', () => {
  it('gerekli başlıkları ve base64 gövdeyi içerir', () => {
    const message = buildMimeMessage({
      to: 'ornek@example.com',
      subject: 'Test',
      body: 'Merhaba dünya'
    })
    expect(message).toContain('To: ornek@example.com')
    expect(message).toContain('Content-Type: text/plain; charset="UTF-8"')

    const body = message.split('\r\n\r\n')[1]
    expect(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Merhaba dünya')
  })
})

describe('buildRawMessage', () => {
  it('base64url üretir (+, / ve = içermez)', () => {
    const raw = buildRawMessage({ to: 'a@b.com', subject: 'Şğüöç', body: 'içerik' })
    expect(raw).not.toMatch(/[+/=]/)
    expect(Buffer.from(raw, 'base64url').toString('utf8')).toContain('To: a@b.com')
  })
})

describe('isValidEmail', () => {
  it('geçerli ve geçersiz adresleri ayırır', () => {
    expect(isValidEmail('ornek@example.com')).toBe(true)
    expect(isValidEmail(' ornek@example.com ')).toBe(true)
    expect(isValidEmail('ornek')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a@b.com, c@d.com')).toBe(false)
  })
})
