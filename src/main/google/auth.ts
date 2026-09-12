import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { shell } from 'electron'
import { getSecret, getSettings, setSecret, updateSettings } from '../settings'
import type { GoogleStatus } from '../../shared/api'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile'

// Gmail okuma, taslak/gönderme ve takvim etkinlikleri
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events'
]

// Kullanıcının tarayıcıda giriş yapması için beklenecek süre
const LOGIN_TIMEOUT_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 20_000

// Tarayıcıda gösterilecek kapanış sayfası
const resultPage = (title: string, message: string): string => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#09090b;color:#e4e4e7;display:flex;height:100vh;margin:0;align-items:center;justify-content:center">
<div style="text-align:center"><h2>${title}</h2><p style="color:#a1a1aa">${message}</p></div>
</body></html>`

interface ClientCredentials {
  clientId: string
  clientSecret: string
}

function requireClient(): ClientCredentials {
  const clientId = getSecret('google-client-id')
  const clientSecret = getSecret('google-client-secret')
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google bağlantısı için önce Ayarlar'daki Google hesabı bölümüne istemci kimliği ve gizli anahtarı girilmeli."
    )
  }
  return { clientId, clientSecret }
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

async function postForm(url: string, form: Record<string, string>): Promise<TokenResponse> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw new Error('Google sunucusuna bağlanılamadı. İnternet bağlantını kontrol et.')
  }

  const text = await response.text()
  if (!response.ok) {
    // Yenileme anahtarı geçersizse bağlantı kopmuştur
    if (text.includes('invalid_grant')) {
      setSecret('google-refresh-token', '')
      updateSettings({ googleAccount: null })
      throw new Error(
        "Google bağlantısının süresi doldu. Ayarlar'dan hesabı yeniden bağlaman gerekiyor."
      )
    }
    if (text.includes('invalid_client')) {
      throw new Error("Google istemci kimliği veya gizli anahtarı hatalı. Ayarlar'dan kontrol et.")
    }
    throw new Error(`Google kimlik doğrulama hatası (HTTP ${response.status}).`)
  }
  return JSON.parse(text) as TokenResponse
}

// Bellekte tutulan erişim anahtarı (kısa ömürlü)
let accessToken: { value: string; expiresAt: number } | null = null

const rememberAccessToken = (tokens: TokenResponse): string => {
  accessToken = {
    value: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000
  }
  return accessToken.value
}

/**
 * Tarayıcıda Google giriş sayfasını açar, 127.0.0.1 üzerindeki geçici sunucuda cevabı bekler
 * ve dönen kodu kalıcı yenileme anahtarıyla değiştirir (PKCE ile).
 */
async function requestAuthorizationCode(
  clientId: string,
  challenge: string,
  state: string
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      const finish = (title: string, message: string, result?: string): void => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(resultPage(title, message))
        server.close()
        clearTimeout(timer)
        if (result) resolve({ code: result, redirectUri })
        else reject(new Error(message))
      }

      if (error) return finish('Bağlantı iptal edildi', 'Uygulamaya dönebilirsin.')
      if (url.searchParams.get('state') !== state) {
        return finish('Güvenlik hatası', 'Beklenmeyen bir cevap geldi, işlem iptal edildi.')
      }
      if (!code) return finish('Bağlantı tamamlanamadı', 'Google bir kod göndermedi.')
      finish('Google hesabı bağlandı', 'Bu sekmeyi kapatıp uygulamaya dönebilirsin.', code)
    })

    let redirectUri = ''
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Google girişi zaman aşımına uğradı, tekrar dene.'))
    }, LOGIN_TIMEOUT_MS)

    server.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    // Boş bir port işletim sisteminden alınır
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      redirectUri = `http://127.0.0.1:${port}`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',
        prompt: 'consent'
      })
      void shell.openExternal(`${AUTH_URL}?${params.toString()}`)
    })
  })
}

async function fetchAccountEmail(token: string): Promise<string> {
  const response = await fetch(PROFILE_URL, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error('Gmail hesabı bilgisi alınamadı.')
  const profile = (await response.json()) as { emailAddress?: string }
  return profile.emailAddress ?? ''
}

export async function connectGoogle(): Promise<GoogleStatus> {
  const { clientId, clientSecret } = requireClient()
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomUUID()

  const { code, redirectUri } = await requestAuthorizationCode(clientId, challenge, state)
  const tokens = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  })

  if (!tokens.refresh_token) {
    throw new Error(
      'Google kalıcı bir yenileme anahtarı vermedi. Google hesap ayarlarından uygulamanın erişimini kaldırıp tekrar dene.'
    )
  }
  setSecret('google-refresh-token', tokens.refresh_token)
  const token = rememberAccessToken(tokens)

  const email = await fetchAccountEmail(token)
  updateSettings({ googleAccount: email })
  return getGoogleStatus()
}

export async function disconnectGoogle(): Promise<GoogleStatus> {
  const refreshToken = getSecret('google-refresh-token')
  if (refreshToken) {
    // Erişimi Google tarafında da iptal et; başarısız olsa da yerel kayıt silinir
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }).catch(() => undefined)
  }
  setSecret('google-refresh-token', '')
  updateSettings({ googleAccount: null })
  accessToken = null
  return getGoogleStatus()
}

/** Araçlar bunu kullanır: gerekirse yenileme anahtarıyla yeni erişim anahtarı alır */
export async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now()) return accessToken.value

  const refreshToken = getSecret('google-refresh-token')
  if (!refreshToken) {
    throw new Error(
      "Google hesabı bağlı değil. Ayarlar'daki Google hesabı bölümünden bağlayabilirsin."
    )
  }
  const { clientId, clientSecret } = requireClient()
  const tokens = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })
  return rememberAccessToken(tokens)
}

export function getGoogleStatus(): GoogleStatus {
  return {
    hasClient: Boolean(getSecret('google-client-id') && getSecret('google-client-secret')),
    connected: Boolean(getSecret('google-refresh-token')),
    email: getSettings().googleAccount
  }
}
