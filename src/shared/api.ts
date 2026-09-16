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
}

export interface ChatMessage {
  id: number
  conversationId: number
  role: ChatRole
  content: string
  tools: ToolActivity[]
  createdAt: string
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
  | { conversationId: number; type: 'approval-resolved'; approvalId: string; approved: boolean }
  | { conversationId: number; type: 'done'; message: ChatMessage }
  | { conversationId: number; type: 'stopped'; message: ChatMessage | null }
  | { conversationId: number; type: 'error'; error: string; message: ChatMessage | null }

// ---- Görevler, hatırlatmalar, notlar, hafıza ----

export type DataScope =
  'tasks' | 'reminders' | 'notes' | 'memories' | 'settings' | 'conversations' | 'activity'

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

export interface Note {
  id: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface NotePatch {
  title?: string
  content?: string
}

export interface Memory {
  id: number
  content: string
  createdAt: string
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

export type ActivityStatus = 'done' | 'error' | 'denied' | 'timeout'

/** Onay durumu: kullanıcı onayladı veya rutin izniyle onaysız çalıştı; onay gerekmediyse null */
export type ActivityApproval = 'approved' | 'auto' | null

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
export type AppCommand = 'focus-chat' | 'new-chat' | 'daily-brief' | 'open-tasks'

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
  calendar: {
    /** Google Takvim etkinlikleri (ISO zaman aralığı, en fazla 62 gün); hesap bağlı değilse boş liste */
    events(from: string, to: string): Promise<CalendarItem[]>
  }
  system: {
    /** Ana Sayfa'daki sistem durumu kartının bilgileri */
    status(): Promise<SystemStatus>
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
  }
  memories: {
    list(): Promise<Memory[]>
    create(content: string): Promise<Memory>
    update(id: number, content: string): Promise<Memory>
    remove(id: number): Promise<void>
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
  }
}
