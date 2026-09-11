import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings, Sparkles } from 'lucide-react'
import {
  PROVIDERS,
  type ChatMessage,
  type Conversation,
  type SettingsView,
  type ToolActivity
} from '@shared/api'
import ConversationList from '../components/chat/ConversationList'
import MessageBubble from '../components/chat/MessageBubble'
import Composer from '../components/chat/Composer'
import { errorMessage } from '../lib/errors'

const SUGGESTIONS = [
  'Bugünümü planlamama yardım et',
  'Yarın saat 9’da spor yapmamı hatırlat',
  'Listeme market alışverişi ekle'
]

interface ChatPageProps {
  active: boolean
  onOpenSettings: () => void
}

// O an yazılmakta olan cevap
interface Streaming {
  conversationId: number
  text: string
  tools: ToolActivity[]
}

function upsertTool(list: ToolActivity[], activity: ToolActivity): ToolActivity[] {
  return list.some((t) => t.id === activity.id)
    ? list.map((t) => (t.id === activity.id ? activity : t))
    : [...list, activity]
}

function ChatPage({ active, onOpenSettings }: ChatPageProps): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState<Streaming | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Olay dinleyicisi içinde her zaman güncel sohbet kimliğini okumak için
  const activeIdRef = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(async (): Promise<void> => {
    setConversations(await window.api.conversations.list())
  }, [])

  // Sayfa her görünür olduğunda ayarları tazele (Ayarlar'da model değişmiş olabilir)
  useEffect(() => {
    if (!active) return
    window.api.settings
      .get()
      .then(setSettings)
      .catch((err) => setError(errorMessage(err)))
  }, [active])

  useEffect(() => {
    window.api.conversations
      .list()
      .then(setConversations)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  // Ana süreçten parça parça gelen cevabı ve araç kullanımlarını dinle
  useEffect(() => {
    return window.api.chat.onEvent((event) => {
      if (event.type === 'delta') {
        setStreaming((s) =>
          s && s.conversationId === event.conversationId ? { ...s, text: s.text + event.text } : s
        )
        return
      }
      if (event.type === 'tool') {
        setStreaming((s) =>
          s && s.conversationId === event.conversationId
            ? { ...s, tools: upsertTool(s.tools, event.activity) }
            : s
        )
        return
      }

      // Cevap bitti, durduruldu veya hata oldu
      setStreaming((s) => (s?.conversationId === event.conversationId ? null : s))
      if (event.conversationId === activeIdRef.current) {
        const message = event.message
        if (message) setMessages((list) => [...list, message])
        if (event.type === 'error') setError(event.error)
      }
      refreshConversations().catch(() => {})
    })
  }, [refreshConversations])

  const streamingView = streaming && streaming.conversationId === activeId ? streaming : null

  // Yeni mesaj veya yeni cevap parçası gelince en alta kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, streamingView])

  function openConversation(id: number | null): void {
    activeIdRef.current = id
    setActiveId(id)
    setMessages([])
    setError(null)
  }

  async function selectConversation(id: number): Promise<void> {
    openConversation(id)
    try {
      setMessages(await window.api.conversations.messages(id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function deleteConversation(id: number): Promise<void> {
    if (!window.confirm('Bu sohbet silinsin mi?')) return
    try {
      await window.api.conversations.remove(id)
      if (activeIdRef.current === id) openConversation(null)
      await refreshConversations()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function send(text: string): Promise<void> {
    setError(null)
    try {
      let id = activeIdRef.current
      if (id === null) {
        id = (await window.api.conversations.create()).id
        openConversation(id)
      }
      setStreaming({ conversationId: id, text: '', tools: [] })
      const userMessage = await window.api.chat.send(id, text)
      setMessages((list) => [...list, userMessage])
      await refreshConversations()
    } catch (err) {
      setStreaming(null)
      setError(errorMessage(err))
    }
  }

  const modelName = settings ? settings.models[settings.provider] : ''
  const modelReady =
    !!settings &&
    modelName !== '' &&
    (settings.provider === 'ollama' || settings.hasApiKey[settings.provider])
  const activeTitle = conversations.find((c) => c.id === activeId)?.title || 'Yeni sohbet'
  const showEmptyState = messages.length === 0 && streamingView === null

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => void selectConversation(id)}
        onNew={() => openConversation(null)}
        onDelete={(id) => void deleteConversation(id)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-5">
          <h1 className="truncate text-sm font-medium text-zinc-200">{activeTitle}</h1>
          {settings &&
            (modelReady ? (
              <span className="shrink-0 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                {PROVIDERS[settings.provider].label} · {modelName}
              </span>
            ) : (
              <button
                onClick={onOpenSettings}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-500/20"
              >
                <Settings className="h-3.5 w-3.5" />
                Model seçilmedi, Ayarlar&apos;a git
              </button>
            ))}
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {showEmptyState ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15">
                <Sparkles className="h-7 w-7 text-violet-400" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Merhaba! Nasıl yardımcı olabilirim?
              </h2>
              <p className="max-w-md text-sm text-zinc-400">
                {modelReady
                  ? 'Sohbet edebilir, görev ve hatırlatma ekletebilir, not tutturabilirsin.'
                  : "Başlamak için Ayarlar'dan bir yapay zeka modeli seç."}
              </p>
              {modelReady && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => void send(suggestion)}
                      disabled={streaming !== null}
                      className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  tools={message.tools}
                />
              ))}
              {streamingView && (
                <MessageBubble
                  role="assistant"
                  content={streamingView.text}
                  tools={streamingView.tools}
                  pending
                />
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {error && (
            <div className="mx-auto w-full max-w-3xl px-5 pb-4">
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300 select-text">
                {error}
              </div>
            </div>
          )}
        </div>

        <Composer
          busy={streaming !== null}
          disabled={!modelReady}
          onSend={(text) => void send(text)}
          onStop={() => {
            if (streaming) void window.api.chat.stop(streaming.conversationId)
          }}
        />
      </div>
    </div>
  )
}

export default ChatPage
