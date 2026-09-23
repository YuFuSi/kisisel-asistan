import { safeStorage } from 'electron'
import { getDb } from './db'
import { DEFAULT_SHORTCUT } from '../shared/shortcut'
import {
  PROVIDER_IDS,
  PROVIDERS,
  SECRET_IDS,
  CONTEXT_LENGTHS,
  TONE_LABELS,
  type AppSettings,
  type SecretId,
  type SettingsPatch
} from '../shared/api'

const SETTINGS_KEY = 'app'
// Hakkımda metni her sohbette talimata eklendiği için sınırlı tutulur
const ABOUT_ME_LIMIT = 1500

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
  globalShortcut: DEFAULT_SHORTCUT,
  googleAccount: null,
  sttProvider: 'groq',
  speakReplies: false,
  voiceUri: '',
  briefEnabled: false,
  briefTime: '08:00',
  briefCity: '',
  briefSpoken: false,
  aboutMe: '',
  tone: 'dengeli',
  temperature: null,
  contextLength: null,
  ttsEngine: 'windows',
  wakeWordEnabled: false,
  wakeWordThreshold: 0.5,
  voiceBargeIn: false,
  // Test edildi (2026-09-14): length_scale 0,75-0,80 arası gerçek hızı ~1,24x yapıyor, doğallık bozulmuyor
  speechRate: 1.3,
  speechVolume: 1,
  semanticSearchEnabled: false
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
  let saved: Partial<AppSettings>
  try {
    saved = JSON.parse(raw) as Partial<AppSettings>
  } catch (err) {
    // Bozuk JSON açılışı kilitlemesin: uygulama varsayılan ayarlarla devam eder. Bozuk değer,
    // sonradan incelenebilsin diye ayrı bir anahtarda saklanır, üzerine yazılmaz.
    console.error('Kayıtlı ayarlar okunamadı (bozuk JSON), varsayılanlara dönülüyor:', err)
    writeValue(`app:corrupt:${Date.now()}`, raw)
    return { ...defaults, models: { ...defaults.models } }
  }
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
  if (patch.googleAccount !== undefined) next.googleAccount = patch.googleAccount
  if (
    patch.sttProvider === 'local' ||
    patch.sttProvider === 'groq' ||
    patch.sttProvider === 'openai'
  ) {
    next.sttProvider = patch.sttProvider
  }
  if (typeof patch.speakReplies === 'boolean') next.speakReplies = patch.speakReplies
  if (typeof patch.voiceUri === 'string') next.voiceUri = patch.voiceUri
  if (typeof patch.briefEnabled === 'boolean') next.briefEnabled = patch.briefEnabled
  if (typeof patch.briefTime === 'string') {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(patch.briefTime.trim())) {
      throw new Error('Özet saati SS:DD biçiminde olmalı, ör. 08:00.')
    }
    next.briefTime = patch.briefTime.trim()
  }
  if (typeof patch.briefCity === 'string') next.briefCity = patch.briefCity.trim()
  if (typeof patch.briefSpoken === 'boolean') next.briefSpoken = patch.briefSpoken
  if (typeof patch.aboutMe === 'string') {
    const about = patch.aboutMe.trim()
    if (about.length > ABOUT_ME_LIMIT) {
      throw new Error(`Hakkımda metni en fazla ${ABOUT_ME_LIMIT} karakter olabilir.`)
    }
    next.aboutMe = about
  }
  if (patch.tone !== undefined) {
    if (!(patch.tone in TONE_LABELS)) throw new Error('Bilinmeyen konuşma tonu.')
    next.tone = patch.tone
  }
  if (patch.temperature !== undefined) {
    const value = patch.temperature
    if (value !== null && !(Number.isFinite(value) && value >= 0 && value <= 1.5)) {
      throw new Error('Yaratıcılık değeri 0 ile 1,5 arasında olmalı.')
    }
    next.temperature = value === null ? null : Math.round(value * 10) / 10
  }
  if (patch.contextLength !== undefined) {
    const value = patch.contextLength
    if (value !== null && !CONTEXT_LENGTHS.includes(value)) {
      throw new Error('Geçersiz bağlam uzunluğu.')
    }
    next.contextLength = value
  }
  if (patch.ttsEngine === 'windows' || patch.ttsEngine === 'piper') next.ttsEngine = patch.ttsEngine
  if (typeof patch.wakeWordEnabled === 'boolean') next.wakeWordEnabled = patch.wakeWordEnabled
  if (typeof patch.voiceBargeIn === 'boolean') next.voiceBargeIn = patch.voiceBargeIn
  if (patch.wakeWordThreshold !== undefined) {
    const value = patch.wakeWordThreshold
    if (!(Number.isFinite(value) && value >= 0.2 && value <= 0.9)) {
      throw new Error('Uyandırma hassasiyeti 0,2 ile 0,9 arasında olmalı.')
    }
    next.wakeWordThreshold = Math.round(value * 100) / 100
  }
  if (patch.speechRate !== undefined) {
    const value = patch.speechRate
    if (!(Number.isFinite(value) && value >= 0.8 && value <= 1.6)) {
      throw new Error('Konuşma hızı 0,8 ile 1,6 arasında olmalı.')
    }
    next.speechRate = Math.round(value * 100) / 100
  }
  if (patch.speechVolume !== undefined) {
    const value = patch.speechVolume
    if (!(Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new Error('Ses seviyesi 0 ile 1 arasında olmalı.')
    }
    next.speechVolume = Math.round(value * 100) / 100
  }
  if (typeof patch.semanticSearchEnabled === 'boolean') {
    next.semanticSearchEnabled = patch.semanticSearchEnabled
  }

  writeValue(SETTINGS_KEY, JSON.stringify(next))
  return next
}

// API anahtarları Windows'un kullanıcı hesabına bağlı şifreleme (DPAPI) ile saklanır
const secretKey = (id: SecretId): string => `secret:${id}`

// Çözülemediği günlüğe bir kez yazılan anahtarlar (her cevapta tekrar tekrar yazılmasın)
const reportedUnreadable = new Set<SecretId>()

type SecretRead = { state: 'missing' } | { state: 'ok'; value: string } | { state: 'unreadable' }

function readSecret(id: SecretId): SecretRead {
  const raw = readValue(secretKey(id))
  if (!raw) return { state: 'missing' }
  try {
    return { state: 'ok', value: safeStorage.decryptString(Buffer.from(raw, 'base64')) }
  } catch (err) {
    // Anahtar başka bir Windows oturumunda/kurulumda şifrelenmiş olabilir; çözülemeyen kayıt yok sayılır.
    // Kullanıcı anahtarı yeniden girince (veya Google'ı yeniden bağlayınca) üzerine yazılır.
    if (!reportedUnreadable.has(id)) {
      reportedUnreadable.add(id)
      console.warn(`Kayıtlı "${id}" anahtarı çözülemedi, yok sayılıyor:`, err)
    }
    return { state: 'unreadable' }
  }
}

export function setSecret(id: SecretId, key: string): void {
  if (!SECRET_IDS.includes(id)) throw new Error('Bilinmeyen servis.')
  reportedUnreadable.delete(id)
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
  const secret = readSecret(id)
  return secret.state === 'ok' ? secret.value : undefined
}

/** Kaydı olan ama çözülemeyen anahtarlar (Ayarlar'da "yeniden gir" uyarısı için) */
export function getUnreadableSecrets(): SecretId[] {
  return SECRET_IDS.filter((id) => readSecret(id).state === 'unreadable')
}

export function getSecretStatus(): Record<SecretId, boolean> {
  const status = {} as Record<SecretId, boolean>
  // Sadece gerçekten çözülebilen anahtarlar kayıtlı sayılır
  for (const id of SECRET_IDS) status[id] = getSecret(id) !== undefined
  return status
}

// Kullanıcıya gösterilmeyen tek seferlik bayraklar (ör. "tepsi bilgisi gösterildi")
export function hasFlag(name: string): boolean {
  return readValue(`flag:${name}`) !== undefined
}

export function setFlag(name: string): void {
  writeValue(`flag:${name}`, '1')
}

// Uygulamanın kendi tuttuğu küçük durum bilgileri (ör. sabah özetinin en son gösterildiği gün)
export function getStoredValue(name: string): string | undefined {
  return readValue(`state:${name}`)
}

export function setStoredValue(name: string, value: string): void {
  writeValue(`state:${name}`, value)
}
