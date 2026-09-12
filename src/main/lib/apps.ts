import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Uygulama listesi 5 dakika önbellekte tutulur
const CACHE_MS = 5 * 60_000
const LIST_TIMEOUT_MS = 20_000

export interface StartApp {
  ad: string
  /** Windows uygulama kimliği (AppUserModelID) */
  appId: string
}

let cache: { apps: StartApp[]; time: number } | null = null

/**
 * Windows Başlat menüsündeki uygulamaları listeler (hem klasik hem Mağaza uygulamaları).
 * Sabit bir komut çalıştırılır; modelden gelen metin komuta girmez.
 */
export async function listStartApps(): Promise<StartApp[]> {
  if (cache && Date.now() - cache.time < CACHE_MS) return cache.apps

  const { stdout } = await run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-StartApps | ConvertTo-Json -Compress'],
    { windowsHide: true, timeout: LIST_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }
  )
  const parsed = JSON.parse(stdout.trim() || '[]') as
    { Name: string; AppID: string } | { Name: string; AppID: string }[]
  const apps = (Array.isArray(parsed) ? parsed : [parsed])
    .filter((item) => item?.Name && item?.AppID)
    .map((item) => ({ ad: item.Name, appId: item.AppID }))

  cache = { apps, time: Date.now() }
  return apps
}

const lower = (text: string): string => text.toLocaleLowerCase('tr-TR')

/** Ada göre en uygun uygulamayı seçer: önce birebir eşleşme, sonra tüm kelimeleri içeren en kısa ad */
export function findApp(apps: StartApp[], query: string): StartApp | undefined {
  const needle = lower(query.trim())
  if (!needle) return undefined

  const exact = apps.find((app) => lower(app.ad) === needle)
  if (exact) return exact

  const words = needle.split(/\s+/).filter(Boolean)
  const matches = apps.filter((app) => words.every((word) => lower(app.ad).includes(word)))
  // En kısa ad genelde ana uygulamadır ("Word" ile "Word ile yeni belge" arasından Word seçilir)
  return [...matches].sort((a, b) => a.ad.length - b.ad.length)[0]
}

/** Eşleşme bulunamayınca kullanıcıya önerilecek benzer adlar */
export function suggestApps(apps: StartApp[], query: string, limit = 5): string[] {
  const [firstWord] = lower(query.trim()).split(/\s+/)
  if (!firstWord) return []
  return apps
    .filter((app) => lower(app.ad).includes(firstWord))
    .slice(0, limit)
    .map((app) => app.ad)
}

// Kimlikte beklenmedik karakter olursa uygulama açılmaz
const SAFE_APP_ID = /^[\w.!{}\\:+\- ]+$/

export function isSafeAppId(appId: string): boolean {
  return SAFE_APP_ID.test(appId)
}

/** Uygulamayı Windows uygulama klasörü üzerinden açar */
export async function launchApp(appId: string): Promise<void> {
  if (!isSafeAppId(appId)) {
    throw new Error('Uygulama kimliği beklenmedik karakterler içeriyor, güvenlik için açılmadı.')
  }
  // explorer bazen 1 kodu döndürür ama uygulamayı açar; bu yüzden hata yutuluyor
  await run('explorer.exe', [`shell:AppsFolder\\${appId}`], { windowsHide: true }).catch(
    () => undefined
  )
}
