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

export interface AppSettings {
  provider: ProviderId
  ollamaBaseUrl: string
  models: Record<ProviderId, string>
}

export interface SettingsPatch {
  provider?: ProviderId
  ollamaBaseUrl?: string
  models?: Partial<Record<ProviderId, string>>
}

// Arayüze gönderilen ayarlar: API anahtarlarının kendisi asla gönderilmez, sadece var/yok bilgisi
export interface SettingsView extends AppSettings {
  hasApiKey: Record<CloudProviderId, boolean>
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

export type ChatEvent =
  | { conversationId: number; type: 'delta'; text: string }
  | { conversationId: number; type: 'tool'; activity: ToolActivity }
  | { conversationId: number; type: 'done'; message: ChatMessage }
  | { conversationId: number; type: 'stopped'; message: ChatMessage | null }
  | { conversationId: number; type: 'error'; error: string; message: ChatMessage | null }

// ---- Görevler, hatırlatmalar, notlar, hafıza ----

export type DataScope = 'tasks' | 'reminders' | 'notes' | 'memories'

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

// window.api üzerinden arayüzün kullanabildiği işlemler
export interface Api {
  settings: {
    get(): Promise<SettingsView>
    update(patch: SettingsPatch): Promise<SettingsView>
    setApiKey(provider: CloudProviderId, key: string): Promise<SettingsView>
    testConnection(): Promise<ConnectionResult>
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
  events: {
    /** Veri değişince (arayüzden veya asistanın araçlarından) haber verir */
    onDataChanged(listener: (scope: DataScope) => void): () => void
  }
}
