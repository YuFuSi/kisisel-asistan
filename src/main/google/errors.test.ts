import { describe, expect, it } from 'vitest'
import { describeGooglePermissionError } from './errors'

describe('describeGooglePermissionError', () => {
  it('Gmail API kapalıysa etkinleştirmeyi söyler', () => {
    const body = JSON.stringify({
      error: {
        code: 403,
        message:
          'Gmail API has not been used in project 1234 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/gmail.googleapis.com/overview',
        status: 'PERMISSION_DENIED',
        details: [{ reason: 'SERVICE_DISABLED' }]
      }
    })
    const message = describeGooglePermissionError(body)
    expect(message).toContain('Gmail API etkin değil')
  })

  it('Takvim API kapalıysa onu adıyla söyler', () => {
    const body =
      '{"error":{"message":"Google Calendar API has not been used in project 1 before or it is disabled."}}'
    expect(describeGooglePermissionError(body)).toContain('Google Calendar API etkin değil')
  })

  it('izin kutucukları onaylanmadıysa yeniden bağlanmayı söyler', () => {
    const body =
      '{"error":{"code":403,"message":"Request had insufficient authentication scopes.","details":[{"reason":"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}]}}'
    expect(describeGooglePermissionError(body)).toContain('izinlerin hepsi onaylanmadı')
  })

  it('bilinmeyen hatada null döner', () => {
    expect(describeGooglePermissionError('{"error":{"message":"Rate limit"}}')).toBeNull()
  })
})
