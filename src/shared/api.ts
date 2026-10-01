// Ana süreç (main), preload ve arayüz (renderer) arasında paylaşılan tipler ve sabitler

export type ProviderId = 'ollama' | 'openai' | 'google' | 'anthropic'
export type CloudProviderId = Exclude<ProviderId, 'ollama'>

export interface ProviderInfo {
  label: string
  description: string
  defaultModel: string
  apiKeyUrl?: string
}

export const PROVIDER_IDS: ProviderId[] = ['ollama', 'openai', 'google', 'anthropic']

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  ollama: {
    label: 'Ollama',
    description: 'Bilgisayarında yerel çalışır, ücretsiz',
    defaultModel: ''
  },
  openai: {
    label: 'OpenAI',
    description: 'GPT modelleri, ücretli API',
    defaultModel: 'gpt-5-mini',
    apiKeyUrl: 'https://platform.openai.com/api-keys'
  },
  google: {
    label: 'Google Gemini',
    description: 'Ücretsiz kotası olan bulut modeli',
    defaultModel: 'gemini-2.5-flash',
    apiKeyUrl: 'https://aistudio.google.com/apikey'
  },
  anthropic: {
    label: 'Anthropic Claude',
    description: 'Claude modelleri, ücretli API',
    defaultModel: 'claude-sonnet-5',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys'
  }
}

export const isCloudProvider = (id: ProviderId): id is CloudProviderId => id !== 'ollama'

// Şifreli saklanan anahtarlar: bulut sağlayıcıları + diğer servisler
export type SecretId =
  | CloudProviderId
  | 'tavily'
  | 'groq'
  | 'google-client-id'
  | 'google-client-secret'
  | 'google-refresh-token'

export const SECRET_IDS: SecretId[] = [
  'openai',
  'google',
  'anthropic',
  'tavily',
  'groq',
  'google-client-id',
  'google-client-secret',
  'google-refresh-token'
]

// ---- Ses ----

/** Konuşmayı yazıya çeviren servis */
export type SpeechProvider = 'local' | 'groq' | 'openai'

/** Cevapları seslendiren motor */
export type TtsEngine = 'windows' | 'piper'

/** Yerel ses paketinin parçaları */
export type VoicePackComponent = 'wakeword' | 'piper' | 'piperVoice' | 'whisper' | 'whisperModel'

export interface VoicePackItemStatus {
  id: VoicePackComponent
  label: string
  sizeMb: number
  installed: boolean
}

export interface VoicePackStatus {
  items: VoicePackItemStatus[]
  /** Bütün parçalar kurulu mu */
  installed: boolean
  /** Şu an indirilen parça */
  installing: VoicePackComponent | null
  /** İndirilen parçanın ilerlemesi (bayt) */
  received: number
  total: number
  error: string | null
}

/**
 * Sesli sohbetin aşaması.
 * off: dinlenmiyor, wake: "hey jarvis" bekleniyor, capturing: kullanıcı dinleniyor,
 * transcribing: konuşma yazıya çevriliyor, responding: Jarvis cevap veriyor/konuşuyor.
 */
export type VoicePhase = 'off' | 'wake' | 'capturing' | 'transcribing' | 'responding'

export interface VoiceState {
  phase: VoicePhase
  /** Sesli sohbet sürüyor mu (cevaptan sonra uyandırma kelimesi beklemeden yeniden dinlenir) */
  sessionActive: boolean
}

export type VoiceEvent =
  | { type: 'pack'; status: VoicePackStatus }
  | { type: 'phase'; phase: VoicePhase; sessionActive: boolean }
  | { type: 'wake' }
  | { type: 'caption'; role: 'user' | 'assistant'; text: string; conversationId: number | null }
  /**
   * Çalınacak ses; audio null ise metin Windows sesiyle (voiceUri) okunur.
   * rate: Windows sesinde konuşma hızı çarpanı olarak uygulanır (Piper'da zaten üretim sırasında uygulandı).
   * volume: her iki motorda da oynatma seviyesi (0-1).
   */
  | {
      type: 'play'
      id: number
      audio: ArrayBuffer | null
      text: string
      voiceUri: string
      rate: number
      volume: number
    }
  | { type: 'stop-playback' }
  | { type: 'error'; message: string }

/** Asistanın konuşma tonu */
export type AssistantTone = 'dengeli' | 'samimi' | 'resmi' | 'kisa'

export const TONE_LABELS: Record<AssistantTone, string> = {
  dengeli: 'Dengeli',
  samimi: 'Samimi',
  resmi: 'Resmi',
  kisa: 'Kısa ve öz'
}

/** Ollama bağlam uzunluğu seçenekleri (token) */
export const CONTEXT_LENGTHS = [4096, 8192, 16384, 32768]

/**
 * Ayar boşken Ollama'ya gönderilen bağlam uzunluğu. Ollama'nın kendi varsayılanı (4096) Jarvis'in
 * talimat + araç tanımlarına (~7000 token) yetmiyor; fazlası sessizce kesilip hafıza ve araçlar
 * modele hiç ulaşmıyordu (2026-09-28'de bulundu).
 */
export const DEFAULT_OLLAMA_CONTEXT = 16384

export interface SpeechProviderInfo {
  label: string
  description: string
  /** Bulut servisinin anahtarı; yerel serviste yok */
  secret?: SecretId
  apiKeyUrl?: string
}

export const SPEECH_PROVIDERS: Record<SpeechProvider, SpeechProviderInfo> = {
  local: {
    label: 'Bilgisayarında',
    description: 'İnternetsiz ve ücretsiz (Jarvis ses paketi gerekir)'
  },
  groq: {
    label: 'Groq',
    description: 'Ücretsiz kotası var ve hızlı',
    secret: 'groq',
    apiKeyUrl: 'https://console.groq.com/keys'
  },
  openai: {
    label: 'OpenAI',
    description: 'Ücretli, OpenAI anahtarını kullanır',
    secret: 'openai',
    apiKeyUrl: 'https://platform.openai.com/api-keys'
  }
}

export interface AppSettings {
  provider: ProviderId
  ollamaBaseUrl: string
  models: Record<ProviderId, string>
  /** Pencere kapatılınca uygulama sistem tepsisinde çalışmaya devam etsin */
  closeToTray: boolean
  /** Windows açılınca başlasın (sadece kurulu uygulamada) */
  openAtLogin: boolean
  /** Electron accelerator, ör. "CommandOrControl+Shift+Space"; boşsa kapalı */
  globalShortcut: string
  /** Bağlı Google hesabının e-posta adresi; bağlı değilse null */
  googleAccount: string | null
  /** Konuşmayı yazıya çevirmek için kullanılacak servis */
  sttProvider: SpeechProvider
  /** Asistanın cevapları sesli okunsun mu */
  speakReplies: boolean
  /** Seçili Windows sesi; boşsa Türkçe ses otomatik seçilir */
  voiceUri: string
  /** Her gün belirlenen saatte sabah özeti bildirimi gösterilsin */
  briefEnabled: boolean
  /** Sabah özeti saati, "08:00" */
  briefTime: string
  /** Özetteki hava durumu için şehir; boşsa hava durumu eklenmez */
  briefCity: string
  /** Sabah özeti gösterilince ayrıca sesli de okunsun mu (Jarvis'in ilk gerçek otomasyonu) */
  briefSpoken: boolean
  /** Hatırlatma, proaktif uyarı, pil ve rutin bildirimlerini Jarvis sesli de söylesin */
  noticesSpoken: boolean
  /** Sessiz saatler (SS:DD); bu aralıkta uyarılar sadece yazılı gelir. Gece yarısını aşabilir */
  quietStart: string
  quietEnd: string
  /** Kullanıcının kendini anlattığı metin; her sohbette asistana verilir */
  aboutMe: string
  tone: AssistantTone
  /** Yaratıcılık (0-1.5); null ise modelin varsayılanı */
  temperature: number | null
  /** Ollama bağlam uzunluğu (num_ctx); null ise Ollama varsayılanı */
  contextLength: number | null
  /** Cevapları seslendiren motor: Windows sesi veya yerel Piper sesi */
  ttsEngine: TtsEngine
  /** "Hey Jarvis" deyince dinlemeye başla (mikrofon açık kalır, ses bilgisayardan çıkmaz) */
  wakeWordEnabled: boolean
  /** Uyandırma eşiği (0,2-0,9): düşük değer daha kolay uyanır ama yanlış uyanma artar */
  wakeWordThreshold: number
  /** Jarvis konuşurken kullanıcı konuşmaya başlarsa susup dinlesin (kulaklıkla önerilir) */
  voiceBargeIn: boolean
  /** Konuşma hızı çarpanı (ör. 1,3 = %30 hızlı). Piper'da length_scale'e, Windows sesinde rate'e çevrilir */
  speechRate: number
  /** Ses seviyesi (0-1) */
  speechVolume: number
  /** Hafıza ve notlarda anahtar kelime yerine anlamsal (embedding) arama kullanılsın mı.
   * Açmadan önce Ollama'da "bge-m3" modelinin indirilmiş olması gerekir. */
  semanticSearchEnabled: boolean
  /** Ekranın üst ortasındaki Jarvis Çentiği (onay, iş bitti, çalışan adım) */
  notchEnabled: boolean
  /** Görev çubuğunun üstünde dolaşan masaüstü pet (Jarvis robotu) */
  desktopPetEnabled: boolean
}

export interface SettingsPatch {
  provider?: ProviderId
  ollamaBaseUrl?: string
  models?: Partial<Record<ProviderId, string>>
  closeToTray?: boolean
  openAtLogin?: boolean
  globalShortcut?: string
  googleAccount?: string | null
  sttProvider?: SpeechProvider
  speakReplies?: boolean
  voiceUri?: string
  briefEnabled?: boolean
  briefTime?: string
  briefCity?: string
  briefSpoken?: boolean
  noticesSpoken?: boolean
  quietStart?: string
  quietEnd?: string
  aboutMe?: string
  tone?: AssistantTone
  temperature?: number | null
  contextLength?: number | null
  ttsEngine?: TtsEngine
  wakeWordEnabled?: boolean
  wakeWordThreshold?: number
  voiceBargeIn?: boolean
  speechRate?: number
  speechVolume?: number
  semanticSearchEnabled?: boolean
  notchEnabled?: boolean
  desktopPetEnabled?: boolean
}

// Arayüze gönderilen ayarlar: API anahtarlarının kendisi asla gönderilmez, sadece var/yok bilgisi
export interface SettingsView extends AppSettings {
  /** Hangi servisin anahtarı kayıtlı (anahtarın kendisi arayüze gönderilmez) */
  hasSecret: Record<SecretId, boolean>
  /** Windows ile başlama bu çalıştırmada kullanılabilir mi (geliştirme modunda değil) */
  loginItemSupported: boolean
  /** Global kısayol şu an gerçekten kayıtlı mı (başka uygulama almış olabilir) */
  shortcutActive: boolean
  /** Kaydı olan ama bu bilgisayarda çözülemeyen anahtarlar; kullanıcı yeniden girmeli */
  unreadableSecrets: SecretId[]
}

export interface ConnectionResult {
  ok: boolean
  message: string
}

// ---- Sohbet ----

export interface Conversation {
  id: number
  title: string
  updatedAt: string
  /** Sabitlenen sohbetler listenin başında durur */
  pinned: boolean
}

export interface ConversationSearchResult {
  conversation: Conversation
  /** Eşleşme mesaj içindeyse kısa alıntı */
  snippet: string | null
}

export type ChatRole = 'user' | 'assistant'

export type ToolStatus = 'running' | 'done' | 'error'

/**
 * Araç sonucunun arayüzde kart olarak gösterilecek, yapılandırılmış hâli (bağlamsal kartlar).
 * Modele giden kısaltılmış metin sonuçtan ayrıdır; sadece güvenilir alanları taşır.
 */
export type ToolCard =
  | {
      kind: 'weather'
      place: string
      temperature: number
      condition: string
      days: { day: string; min: number; max: number; rainChance: number | null }[]
    }
  | { kind: 'events'; items: { title: string; time: string; location: string | null }[] }
  | { kind: 'files'; total: number; items: { name: string; path: string; sizeKb: number }[] }
  | { kind: 'task'; title: string; due: string | null }
  | { kind: 'reminder'; message: string; when: string; repeat: string | null }

// Asistanın bir cevap sırasında kullandığı araç (arayüzde küçük etiket olarak görünür)
export interface ToolActivity {
  id: string
  name: string
  label: string
  status: ToolStatus
  /** Modelin araca gönderdiği girdi (sonraki cevaplarda geçmiş olarak modele verilir) */
  input?: unknown
  /** Aracın kısaltılmış sonucu veya hata metni */
  result?: string
  /** Sonucun arayüzdeki kart hâli (hava, takvim, dosya, görev, hatırlatma); yoksa sadece etiket */
  card?: ToolCard
}

/**
 * Bir cevabın nasıl bittiği. "Cevap bitti" ile "iş başarıyla yapıldı" aynı şey değil:
 * - completed: araçların hepsi çalıştı (veya araç yoktu)
 * - partial: cevap bitti ama en az bir araç hata verdi
 * - rejected: kullanıcı bir onayı reddetti
 * - timeout: onay beklenirken süre doldu
 * - stopped: kullanıcı durdurdu
 * - error: cevap hatayla kesildi
 */
export type OutcomeKind = 'completed' | 'partial' | 'rejected' | 'timeout' | 'stopped' | 'error'

export type ApprovalResult = 'approved' | 'denied' | 'timeout'

export interface ChatMessage {
  id: number
  conversationId: number
  role: ChatRole
  content: string
  tools: ToolActivity[]
  createdAt: string
  /** Asistan cevabının sonucu; eski mesajlarda ve kullanıcı mesajlarında null */
  outcome: OutcomeKind | null
}

// Riskli bir araç çalışmadan önce kullanıcıdan onay ister
export interface ToolApproval {
  id: string
  toolName: string
  /** Kartın başlığı, ör. "Uygulama açılsın mı?" */
  label: string
  /** Ne yapılacağı, ör. "Not Defteri" */
  summary: string
  /** Varsa ayrıntı, ör. tam dosya yolu */
  details?: string
}

export type ChatEvent =
  | { conversationId: number; type: 'delta'; text: string }
  | { conversationId: number; type: 'tool'; activity: ToolActivity }
  | { conversationId: number; type: 'approval'; approval: ToolApproval }
  | {
      conversationId: number
      type: 'approval-resolved'
      approvalId: string
      approved: boolean
      result: ApprovalResult
    }
  | { conversationId: number; type: 'done'; message: ChatMessage }
  | { conversationId: number; type: 'stopped'; message: ChatMessage | null }
  | { conversationId: number; type: 'error'; error: string; message: ChatMessage | null }

// ---- Görevler, hatırlatmalar, notlar, hafıza ----

export type DataScope =
  | 'tasks'
  | 'reminders'
  | 'notes'
  | 'memories'
  | 'settings'
  | 'conversations'
  | 'activity'
  | 'automations'

export interface Task {
  id: number
  title: string
  notes: string
  /** Yerel tarih, YYYY-MM-DD */
  dueDate: string | null
  /** Yerel saat, HH:mm; sadece dueDate varsa anlamlı */
  dueTime: string | null
  /** Tamamlanma zamanı (ISO); null ise bekliyor */
  doneAt: string | null
  createdAt: string
}

export interface TaskInput {
  title: string
  notes?: string
  dueDate?: string | null
  dueTime?: string | null
}

export interface TaskPatch {
  title?: string
  notes?: string
  dueDate?: string | null
  dueTime?: string | null
  done?: boolean
}

/** Hatırlatmanın tekrar kuralı */
export type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly'

export const REPEAT_LABELS: Record<RepeatRule, string> = {
  none: 'Tek seferlik',
  daily: 'Her gün',
  weekdays: 'Hafta içi',
  weekly: 'Her hafta'
}

export interface Reminder {
  id: number
  message: string
  /** Epoch milisaniye */
  remindAt: number
  sentAt: number | null
  repeat: RepeatRule
}

/**
 * Bir otomasyonun (rutin) çalışma zamanı ne kadar özgür bırakıldığı.
 * none: yazma dahil her değişiklik onay ister. write: uygulama içi değişiklikler onaysız.
 * all: tehlikeli işlemler de onaysız (dışarıdan gelen içerikle tetiklenenler hariç).
 */
export type RoutineAllowance = 'none' | 'write' | 'all'

export const ALLOWANCE_LABELS: Record<RoutineAllowance, string> = {
  none: 'Salt okunur',
  write: 'Yazma izinli',
  all: 'Tam izinli'
}

/** Kullanıcının sohbet gibi normal bir istek yerine zamanı gelince kendiliğinden çalışan rutin */
export interface Automation {
  id: number
  name: string
  /** Çalışınca asistana normal bir istek gibi verilen serbest metin talimat */
  prompt: string
  /** Yerel saat, HH:mm */
  timeOfDay: string
  repeat: RepeatRule
  allowance: RoutineAllowance
  /** Kapalıysa zamanlayıcı hiç bakmaz; tek seferlik bir rutin çalışınca kendiliğinden kapanır */
  enabled: boolean
  /** Epoch milisaniye */
  nextRunAt: number
  lastRunAt: number | null
  createdAt: string
}

export interface AutomationInput {
  name: string
  prompt: string
  timeOfDay: string
  repeat?: RepeatRule
  allowance?: RoutineAllowance
}

export interface AutomationPatch {
  name?: string
  prompt?: string
  timeOfDay?: string
  repeat?: RepeatRule
  allowance?: RoutineAllowance
  enabled?: boolean
}

/** Bir otomasyonun tek bir çalıştırılışının geçmiş kaydı */
export interface AutomationRun {
  id: number
  automationId: number
  /** Epoch milisaniye */
  startedAt: number
  finishedAt: number | null
  status: 'running' | 'done' | 'error'
  /** Asistanın çalıştırma sonunda ürettiği özet metin */
  summary: string
  /** İzin yetersizliği nedeniyle atlanan araç çağrıları */
  skippedTools: { tool: string; label: string }[]
}

export interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

/** Harita görünümü için: embedding vektörü de dahil (normal `Note`'ta yok, IPC payload'ı
 *  büyümesin diye sadece bu uç nokta embedding taşır). */
export interface NoteWithEmbedding extends Note {
  embedding: number[] | null
}

export interface NotePatch {
  title?: string
  content?: string
}

/** Hafıza kaydının türü; `profil` her sohbette modele gider (çekirdek profil) */
export type MemoryKind = 'profil' | 'bilgi' | 'tercih' | 'kisi' | 'olay' | 'plan'

export const MEMORY_KINDS: readonly MemoryKind[] = [
  'profil',
  'bilgi',
  'tercih',
  'kisi',
  'olay',
  'plan'
]

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  profil: 'Profil',
  bilgi: 'Bilgi',
  tercih: 'Tercih',
  kisi: 'Kişi',
  olay: 'Olay',
  plan: 'Plan'
}

export interface MemoryProcessingResult {
  /** İşlenen sohbet sayısı */
  conversations: number
  added: number
  updated: number
  /** Kalan (bu turda işlenemeyen) sohbet sayısı */
  remaining: number
}

/** arac: model hafizaya_kaydet ile yazdı; otomatik: hafıza işleyici çıkardı; kullanici: elle */
export type MemorySource = 'arac' | 'otomatik' | 'kullanici'

export interface Memory {
  id: number
  content: string
  createdAt: string
  kind: MemoryKind
  source: MemorySource
  /** Bilginin öğrenildiği sohbet (silinmiş olabilir) */
  sourceConversationId: number | null
  /** Otomatik öğrenilen kayıt kullanıcı gözden geçirene kadar false */
  reviewed: boolean
}

/** Harita görünümü için: embedding vektörü de dahil. */
export interface MemoryWithEmbedding extends Memory {
  embedding: number[] | null
}

// ---- Güvenilirlik: araç izinleri, etkinlik kaydı, yedekler ----

/**
 * Aracın risk seviyesi.
 * read: sadece bilgi okur. write: uygulama içindeki veriyi değiştirir (görev, not...).
 * dangerous: dışarıya etki eder veya geri alınması zordur (e-posta gönderme, uygulama/dosya açma).
 */
export type ToolRisk = 'read' | 'write' | 'dangerous'

/** Aracı başlatan: sohbet, rutin (otomasyon), sesli komut veya uzaktan (ör. telefon) */
export type ToolSource = 'chat' | 'automation' | 'voice' | 'remote'

export type ActivityStatus = 'done' | 'error' | 'denied' | 'timeout' | 'skipped'

/**
 * Onay durumu: kullanıcı onayladı veya rutin izniyle onaysız çalıştı; onay gerekmediyse null.
 * skipped: otomasyonun izin seviyesi yetmediği için (pencere açılıp beklenmeden) atlandı.
 */
export type ActivityApproval = 'approved' | 'auto' | 'skipped' | null

// "Son işlemler" listesindeki bir kayıt
export interface ActivityEntry {
  id: number
  /** Epoch milisaniye */
  createdAt: number
  source: ToolSource
  kind: 'tool'
  /** Araç adı, ör. gorev_ekle */
  name: string
  /** Türkçe etiket, ör. "Görev ekleme" */
  label: string
  /** Kısa açıklama, ör. görevin başlığı */
  summary: string
  /** Sonuç veya hata metni (kısaltılmış) */
  detail: string
  status: ActivityStatus
  approval: ActivityApproval
  conversationId: number | null
}

// Analizler sayfası: activity_log'dan hesaplanan kullanım istatistikleri
export interface ToolUsage {
  name: string
  label: string
  count: number
}

export interface DayUsage {
  /** Yerel tarih: 2026-09-22 */
  date: string
  count: number
}

export interface UsageStats {
  totalCalls: number
  doneCalls: number
  errorCalls: number
  /** Onay reddedilen veya izin yetersizliğinden atlanan çağrılar */
  blockedCalls: number
  deniedCalls: number
  timeoutCalls: number
  skippedCalls: number
  /** En çok kullanılan 5 araç, çoktan aza */
  topTools: ToolUsage[]
  /** Son 14 günün günlük çağrı sayısı, en eskiden en yeniye */
  last14Days: DayUsage[]
  /** Bugün dahil, art arda en az bir çağrı yapılan gün sayısı */
  activeDayStreak: number
  voiceCalls: number
  automationCalls: number
  distinctTools: number
}

// Başarımlar sayfası: tamamı activity_log'dan hesaplanır, hiçbir şey dışarı gönderilmez
export interface Achievement {
  id: string
  title: string
  description: string
  achieved: boolean
}

export interface BackupInfo {
  /** Yedek dosyasının adı, ör. asistan-2026-09-14.db */
  name: string
  /** Epoch milisaniye */
  createdAt: number
  /** Bayt */
  size: number
}

// ---- Takvim ve sistem durumu (Ana Sayfa) ----

// Google Takvim etkinliği (arayüz için sadeleştirilmiş)
export interface CalendarItem {
  id: string
  title: string
  /** Epoch milisaniye; tüm gün etkinliklerde o günün yerel başlangıcı */
  start: number
  /** Epoch milisaniye; tüm gün etkinliklerde bitiş günü hariçtir */
  end: number | null
  allDay: boolean
  location: string | null
}

export interface HomeWeather {
  place: string
  temperature: number
  condition: string
  min: number | null
  max: number | null
  rainChance: number | null
}

export interface SystemStatus {
  /** Seçili yapay zeka modeli ve kullanılabilir olup olmadığı */
  model: { label: string; model: string; ok: boolean; message: string }
  googleConnected: boolean
  /** Son yedeğin zamanı (epoch ms); yedek yoksa null */
  lastBackupAt: number | null
  /** Veri klasörünün bulunduğu diskte boş ve toplam alan (bayt); okunamazsa null */
  disk: { free: number; total: number } | null
}

// ---- Google hesabı ----

export interface GoogleStatus {
  /** İstemci kimliği ve gizli anahtarı girilmiş mi */
  hasClient: boolean
  /** Hesap bağlı mı (yenileme anahtarı var mı) */
  connected: boolean
  email: string | null
}

// ---- Uygulama komutları (tepsi menüsü ve global kısayoldan arayüze) ----

// daily-brief: sabah özeti bildirimine tıklanınca yeni sohbette özet istenir
// open-automations: bir otomasyon bildirimine tıklanınca Otomasyonlar sayfası açılır
// open-page:<sayfa>: çentikten veya bildirimden bir sayfa açılır
export type AppCommand =
  | 'focus-chat'
  | 'new-chat'
  | 'daily-brief'
  | 'open-tasks'
  | 'open-automations'
  | 'notified'
  | `open-page:${string}`

// window.api üzerinden arayüzün kullanabildiği işlemler
/** Sohbete eklenen belgenin okunan ilk parçası */
export interface AttachedDocument {
  name: string
  path: string
  text: string
  partCount: number
  charCount: number
}

export interface Api {
  app: {
    /** package.json'daki sürüm (arayüzün altında gösterilir) */
    version(): Promise<string>
    /** Arayüzde yakalanan hatayı günlük dosyasına yazar */
    logError(message: string): void
    /** Günlük dosyalarının klasörünü Dosya Gezgini'nde açar */
    openLogs(): Promise<void>
  }
  backups: {
    /** Yedekler, en yenisi başta */
    list(): Promise<BackupInfo[]>
    /** Hemen yedek alır (bugünün yedeği varsa üzerine yazar) */
    create(): Promise<BackupInfo>
    /**
     * Onay penceresi gösterir; onaylanırsa mevcut veriyi ayrıca yedekleyip seçilen yedeği yükler ve
     * uygulamayı yeniden başlatır. Vazgeçilirse false döner.
     */
    restore(name: string): Promise<boolean>
  }
  activity: {
    /** Son işlemler, en yenisi başta */
    list(limit?: number): Promise<ActivityEntry[]>
  }
  analytics: {
    /** Analizler sayfası: son 180 günün kullanım istatistikleri */
    usage(): Promise<UsageStats>
    /** Başarımlar sayfası: kazanılan ve kazanılmamış rozetler */
    achievements(): Promise<Achievement[]>
  }
  calendar: {
    /** Google Takvim etkinlikleri (ISO zaman aralığı, en fazla 62 gün); hesap bağlı değilse boş liste */
    events(from: string, to: string): Promise<CalendarItem[]>
  }
  system: {
    /** Ana Sayfa'daki sistem durumu kartının bilgileri */
    status(): Promise<SystemStatus>
    /**
     * Ana Sayfa karşılamasının altındaki kişisel not (hafıza + bugünün görev, hatırlatma ve
     * takvimi, yerel modelle). Üretilemezse null; arayüz düz özete düşer.
     */
    personalNote(): Promise<string | null>
    /** Ana Sayfa hava kartı (sabah özeti şehri); şehir yoksa veya alınamazsa null */
    weather(): Promise<HomeWeather | null>
  }
  documents: {
    /** Sürükle-bırak ile gelen dosyanın diskteki yolu (Electron'da File.path artık yok) */
    pathForFile(file: File): string
    /**
     * Kullanıcının seçtiği belgenin ilk parçasını okur. Belge bu sohbet için onaylanmış sayılır;
     * asistan devamını belge_oku ile onay sormadan okuyabilir.
     */
    read(conversationId: number, path: string): Promise<AttachedDocument>
  }
  brief: {
    /** Sabah özeti bildirimini hemen gösterir (Ayarlar'daki "Şimdi dene") */
    preview(): Promise<void>
  }
  settings: {
    get(): Promise<SettingsView>
    update(patch: SettingsPatch): Promise<SettingsView>
    /** Boş anahtar gönderilirse kayıtlı anahtar silinir */
    setSecret(id: SecretId, key: string): Promise<SettingsView>
    testConnection(): Promise<ConnectionResult>
    /** Kısayol kaydedilirken mevcut global kısayolu geçici olarak devre dışı bırakır */
    suspendShortcut(suspended: boolean): Promise<void>
  }
  ollama: {
    listModels(): Promise<string[]>
  }
  conversations: {
    list(): Promise<Conversation[]>
    create(): Promise<Conversation>
    remove(id: number): Promise<void>
    messages(id: number): Promise<ChatMessage[]>
    rename(id: number, title: string): Promise<Conversation>
    pin(id: number, pinned: boolean): Promise<Conversation>
    /** Başlıklarda ve mesaj içeriklerinde arar */
    search(query: string): Promise<ConversationSearchResult[]>
    /** Sohbeti Markdown dosyası olarak kaydeder; kullanıcı vazgeçerse null döner */
    exportMarkdown(id: number): Promise<string | null>
  }
  chat: {
    /** Kullanıcı mesajını kaydeder ve cevabı başlatır; cevap chat.onEvent ile parça parça gelir */
    send(conversationId: number, text: string): Promise<ChatMessage>
    stop(conversationId: number): Promise<void>
    /** Son cevabı silip yeniden üretir */
    regenerate(conversationId: number): Promise<void>
    /** Bir kullanıcı mesajını düzenleyip o noktadan sonrasını yeniden yazdırır */
    editAndResend(conversationId: number, messageId: number, text: string): Promise<ChatMessage>
    /** Onay kartındaki cevabı ana sürece iletir */
    respondToApproval(approvalId: string, approved: boolean): Promise<void>
    onEvent(listener: (event: ChatEvent) => void): () => void
  }
  tasks: {
    list(): Promise<Task[]>
    create(input: TaskInput): Promise<Task>
    update(id: number, patch: TaskPatch): Promise<Task>
    remove(id: number): Promise<void>
  }
  automations: {
    list(): Promise<Automation[]>
    create(input: AutomationInput): Promise<Automation>
    update(id: number, patch: AutomationPatch): Promise<Automation>
    remove(id: number): Promise<void>
    /** Zamanını beklemeden hemen çalıştırır ("şimdi çalıştır") */
    runNow(id: number): Promise<AutomationRun>
    listRuns(automationId: number): Promise<AutomationRun[]>
  }
  reminders: {
    /** Henüz gösterilmemiş hatırlatmalar */
    list(): Promise<Reminder[]>
    create(message: string, remindAt: number, repeat?: RepeatRule): Promise<Reminder>
    remove(id: number): Promise<void>
    /** Hatırlatmayı verilen dakika kadar ileri atar */
    snooze(id: number, minutes: number): Promise<Reminder>
  }
  notes: {
    list(): Promise<Note[]>
    create(input: NotePatch): Promise<Note>
    update(id: number, patch: NotePatch): Promise<Note>
    remove(id: number): Promise<void>
    /** Embedding'i eksik notları hesaplayıp doldurur; kaç kaydın işlendiğini döndürür */
    backfillEmbeddings(): Promise<number>
    /** Notlarda arama (anlamsal arama açıksa anlam benzerliğine göre) */
    search(query: string): Promise<Note[]>
    /** Hafıza haritası için: embedding vektörleriyle birlikte tüm notlar */
    listWithEmbeddings(): Promise<NoteWithEmbedding[]>
  }
  memories: {
    list(): Promise<Memory[]>
    create(content: string): Promise<Memory>
    update(id: number, content: string): Promise<Memory>
    remove(id: number): Promise<void>
    /** Embedding'i eksik kayıtları hesaplayıp doldurur; kaç kaydın işlendiğini döndürür */
    backfillEmbeddings(): Promise<number>
    /** Hafızada arama (anlamsal arama açıksa anlam benzerliğine göre) */
    search(query: string): Promise<Memory[]>
    /** Hafıza haritası için: embedding vektörleriyle birlikte tüm hafıza kayıtları */
    listWithEmbeddings(): Promise<MemoryWithEmbedding[]>
    /** Otomatik öğrenilip henüz gözden geçirilmemiş kayıtlar */
    listUnreviewed(): Promise<Memory[]>
    /** Kayıtları gözden geçirildi sayar; ids verilmezse hepsini */
    markReviewed(ids?: number[]): Promise<void>
    setKind(id: number, kind: MemoryKind): Promise<void>
    /** Bekleyen sohbetleri kullanıcının boşta olmasını beklemeden şimdi işler */
    processNow(): Promise<MemoryProcessingResult>
  }
  speech: {
    /** Ses kaydını yazıya çevirir */
    transcribe(audio: ArrayBuffer, mimeType: string): Promise<string>
  }
  voice: {
    packStatus(): Promise<VoicePackStatus>
    /** Eksik parçaları indirir; ilerleme voice.onEvent ile 'pack' olayı olarak gelir */
    installPack(): Promise<VoicePackStatus>
    /** Sesli sohbetin şu anki aşaması (arayüz açılırken okunur, sonra olaylarla güncellenir) */
    state(): Promise<VoiceState>
    /** Mikrofondan 80 ms'lik ses (1280 örnek, 16 kHz, -1..1) */
    pushAudio(chunk: Float32Array): void
    /** Uyandırma kelimesi beklemeden dinlemeye başla (küreye tıklama) */
    startTurn(): Promise<void>
    /** Sesli sohbeti bitir */
    stopSession(): Promise<void>
    /** Metni seçili motorla seslendir (sohbetteki "sesli oku") */
    speak(text: string): Promise<void>
    /** Seslendirmeyi durdur */
    stopSpeaking(): Promise<void>
    /** Arayüz bir sesi çalmayı bitirdi (veya durdurdu) */
    playbackEnded(id: number): void
    onEvent(listener: (event: VoiceEvent) => void): () => void
  }
  google: {
    status(): Promise<GoogleStatus>
    /** Tarayıcıda Google giriş sayfasını açar ve hesabı bağlar; bağlanan hesabın adresini döndürür */
    connect(): Promise<GoogleStatus>
    disconnect(): Promise<GoogleStatus>
  }
  events: {
    /** Veri değişince (arayüzden, asistanın araçlarından veya tepsi menüsünden) haber verir */
    onDataChanged(listener: (scope: DataScope) => void): () => void
    /** Tepsi menüsü veya global kısayoldan gelen komutlar */
    onCommand(listener: (command: AppCommand) => void): () => void
    /** Çentiğe bırakılan belgelerin yolları: ana pencere bunları yeni sohbete ekler */
    onAttachPaths(listener: (paths: string[]) => void): () => void
  }
  pet: {
    /** Masaüstü pet: fare robotun üstündeyken pencere tıklamaları alsın mı */
    setInteractive(interactive: boolean): void
  }
  notch: {
    /** Çentik penceresini içeriğinin boyuna getirir (ekranın üst ortasında kalır) */
    resize(width: number, height: number): void
    /** Çentiğe bırakılan belgeleri ana pencereye gönderir (yeni sohbete eklenir) */
    dropFiles(paths: string[]): void
    /** Ana pencereyi öne getirip verilen sayfayı açar (çentikteki "Sohbette aç") */
    navigate(page: string): Promise<void>
  }
  /**
   * Kamera el kontrolündeki "pencere sürükle" jesti için: sohbetten/onaydan bağımsız, doğrudan
   * çağrı. Kullanıcının kendi eliyle sürüklemesi fareyle sürüklemekle aynı güven seviyesinde
   * sayılır, bu yüzden AI aracı onayı gerektirmez (bkz. tools/windows.ts'teki karşılıkları).
   */
  windows: {
    /** O anda öndeki (odaklanmış) pencerenin pid'si; görünür pencere yoksa null */
    foreground(): Promise<number | null>
    /** Pencereyi ekranda verilen konuma taşır; boyutu değişmez */
    move(id: number, x: number, y: number): Promise<void>
  }
}
