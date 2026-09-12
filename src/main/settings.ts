import { safeStorage } from 'electron'
import { getDb } from './db'
import { DEFAULT_SHORTCUT } from '../shared/shortcut'
import {
  PROVIDER_IDS,
  PROVIDERS,
  SECRET_IDS,
  type AppSettings,
  type SecretId,
  type SettingsPatch
} from '../shared/api'

const SETTINGS_KEY = 'app'

const defaults: AppSettings = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  models: {
    ollama: PROVIDERS.ollama.defaultModel,
    openai: PROVIDERS.openai.defaultModel,
    google: PROVIDERS.google.defaultModel,
    anthropic: PROVIDERS.anthropic.defaultModel
  },
  closeToTray: true,
  openAtLogin: false,
  globalShortcut: DEFAULT_SHORTCUT
}

function readValue(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value
}

function writeValue(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

// Kayıtlı ayarlar varsayılanlarla birleştirilir; böylece sonradan eklenen ayarlar da değer alır
export function getSettings(): AppSettings {
  const raw = readValue(SETTINGS_KEY)
  if (!raw) return { ...defaults, models: { ...defaults.models } }
  const saved = JSON.parse(raw) as Partial<AppSettings>
  return { ...defaults, ...saved, models: { ...defaults.models, ...saved.models } }
}

export function updateSettings(patch: SettingsPatch): AppSettings {
  const current = getSettings()
  const next: AppSettings = { ...current, models: { ...current.models } }

  if (patch.provider !== undefined) {
    if (!PROVIDER_IDS.includes(patch.provider)) throw new Error('Bilinmeyen sağlayıcı.')
    next.provider = patch.provider
  }
  if (patch.ollamaBaseUrl !== undefined) {
    const url = patch.ollamaBaseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new Error('Sunucu adresi http:// veya https:// ile başlamalı.')
    }
    next.ollamaBaseUrl = url
  }
  for (const id of PROVIDER_IDS) {
    const model = patch.models?.[id]
    if (typeof model === 'string') next.models[id] = model.trim()
  }
  if (typeof patch.closeToTray === 'boolean') next.closeToTray = patch.closeToTray
  if (typeof patch.openAtLogin === 'boolean') next.openAtLogin = patch.openAtLogin
  if (typeof patch.globalShortcut === 'string') next.globalShortcut = patch.globalShortcut.trim()

  writeValue(SETTINGS_KEY, JSON.stringify(next))
  return next
}

// API anahtarları Windows'un kullanıcı hesabına bağlı şifreleme (DPAPI) ile saklanır
const secretKey = (id: SecretId): string => `secret:${id}`

export function setSecret(id: SecretId, key: string): void {
  if (!SECRET_IDS.includes(id)) throw new Error('Bilinmeyen servis.')
  const value = key.trim()
  if (!value) {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(secretKey(id))
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Bu bilgisayarda şifreli saklama kullanılamıyor.')
  }
  writeValue(secretKey(id), safeStorage.encryptString(value).toString('base64'))
}

export function getSecret(id: SecretId): string | undefined {
  const raw = readValue(secretKey(id))
  return raw ? safeStorage.decryptString(Buffer.from(raw, 'base64')) : undefined
}

export function getSecretStatus(): Record<SecretId, boolean> {
  const has = (id: SecretId): boolean => readValue(secretKey(id)) !== undefined
  return {
    openai: has('openai'),
    google: has('google'),
    anthropic: has('anthropic'),
    tavily: has('tavily')
  }
}

// Kullanıcıya gösterilmeyen tek seferlik bayraklar (ör. "tepsi bilgisi gösterildi")
export function hasFlag(name: string): boolean {
  return readValue(`flag:${name}`) !== undefined
}

export function setFlag(name: string): void {
  writeValue(`flag:${name}`, '1')
}
