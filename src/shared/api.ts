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
export type SpeechProvider = 'groq' | 'openai'

export interface SpeechProviderInfo {
  label: string
  description: string
  secret: SecretId
  apiKeyUrl: string
}

export const SPEECH_PROVIDERS: Record<SpeechProvider, SpeechProviderInfo> = {
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
}

// Arayüze gönderilen ayarlar: API anahtarlarının kendisi asla gönderilmez, sadece var/yok bilgisi
export interface SettingsView extends AppSettings {
  /** Hangi servisin anahtarı kayıtlı (anahtarın kendisi arayüze gönderilmez) */
  hasSecret: Record<SecretId, boolean>
  /** Windows ile başlama bu çalıştırmada kullanılabilir mi (geliştirme modunda değil) */
  loginItemSupported: boolean
  /** Global kısayol şu an gerçekten kayıtlı mı (başka uygulama almış olabilir) */
  shortcutActive: boolean
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
}

export type ChatRole = 'user' | 'assistant'

export type ToolStatus = 'running' | 'done' | 'error'

// Asistanın bir cevap sırasında kullandığı araç (arayüzde küçük etiket olarak görünür)
export interface ToolActivity {
  id: string
  name: string
  label: string
  status: ToolStatus
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

export type DataScope = 'tasks' | 'reminders' | 'notes' | 'memories' | 'settings'

export interface Task {
  id: number
  title: string
  notes: string
  /** Yerel tarih, YYYY-MM-DD */
  dueDate: string | null
  /** Tamamlanma zamanı (ISO); null ise bekliyor */
  doneAt: string | null
  createdAt: string
}

export interface TaskInput {
  title: string
  notes?: string
  dueDate?: string | null
}

export interface TaskPatch {
  title?: string
  notes?: string
  dueDate?: string | null
  done?: boolean
}

export interface Reminder {
  id: number
  message: string
  /** Epoch milisaniye */
  remindAt: number
  sentAt: number | null
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

// ---- Google hesabı ----

export interface GoogleStatus {
  /** İstemci kimliği ve gizli anahtarı girilmiş mi */
  hasClient: boolean
  /** Hesap bağlı mı (yenileme anahtarı var mı) */
  connected: boolean
  email: string | null
}

// ---- Uygulama komutları (tepsi menüsü ve global kısayoldan arayüze) ----

export type AppCommand = 'focus-chat' | 'new-chat'

// window.api üzerinden arayüzün kullanabildiği işlemler
export interface Api {
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
  }
  chat: {
    /** Kullanıcı mesajını kaydeder ve cevabı başlatır; cevap chat.onEvent ile parça parça gelir */
    send(conversationId: number, text: string): Promise<ChatMessage>
    stop(conversationId: number): Promise<void>
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
    create(message: string, remindAt: number): Promise<Reminder>
    remove(id: number): Promise<void>
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
    remove(id: number): Promise<void>
  }
  speech: {
    /** Ses kaydını yazıya çevirir */
    transcribe(audio: ArrayBuffer, mimeType: string): Promise<string>
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
