// Gmail API, gönderilecek e-postayı RFC 2822 metni olarak ve base64url kodlanmış ister.

export interface MailInput {
  to: string
  subject: string
  body: string
}

const isAscii = (value: string): boolean => /^[\x20-\x7E]*$/.test(value)

/** Türkçe karakterli başlıklar "encoded word" biçiminde yazılır, yoksa bozuk görünür */
export function encodeHeaderValue(value: string): string {
  const clean = value.replace(/[\r\n]+/g, ' ').trim()
  if (isAscii(clean)) return clean
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`
}

// base64 gövde satırları 76 karakterde bölünür (RFC 2045)
const wrapBase64 = (text: string): string => (text.match(/.{1,76}/g) ?? []).join('\r\n')

export function buildMimeMessage(mail: MailInput): string {
  return [
    `To: ${encodeHeaderValue(mail.to)}`,
    `Subject: ${encodeHeaderValue(mail.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(mail.body, 'utf8').toString('base64'))
  ].join('\r\n')
}

/** Gmail API'nin "raw" alanına konacak hali */
export function buildRawMessage(mail: MailInput): string {
  return Buffer.from(buildMimeMessage(mail), 'utf8').toString('base64url')
}

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export function isValidEmail(address: string): boolean {
  return EMAIL_PATTERN.test(address.trim())
}
