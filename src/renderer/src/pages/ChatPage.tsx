import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, Download, FileUp, Settings, History } from 'lucide-react'
import { composeMessage } from '@shared/attachments'
import {
  PROVIDERS,
  type AttachedDocument,
  type ChatMessage,
  type Conversation,
  type ConversationSearchResult,
  type Reminder,
  type SettingsView,
  type Task,
  type ToolActivity
} from '@shared/api'
import ConversationList from '../components/chat/ConversationList'
import HistoryDrawer from '../components/chat/HistoryDrawer'
import { useNarrowWindow } from '../lib/useNarrowWindow'
import MessageBubble from '../components/chat/MessageBubble'
import Composer from '../components/chat/Composer'
import ActivitySurface from '../components/chat/ActivitySurface'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Orb from '../components/jarvis/Orb'
import {
  noteReplyFailed,
  noteReplyStarted,
  respondToApproval,
  setVisibleConversation,
  useAssistantState,
  useLastOutcome,
  usePendingApprovals
} from '../lib/assistantState'
import { errorMessage } from '../lib/errors'
import { focusConversationSearch } from '../lib/dom'
import { greeting } from '../lib/greeting'
import { buildHomeSummary } from '../lib/homeSummary'
import { quietIconButtonClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { useLiveData } from '../lib/useLiveData'
import { speakText, stopSpeaking } from '../lib/voice'
import { useReducedMotion } from '../lib/useReducedMotion'
import { isNearScrollEnd } from '../lib/chatScroll'
import {
  activityRecordKey,
  forgetConversationOutcomes,
  readActivityOutcomes,
  rememberActivityOutcome,
  saveActivityOutcomes
} from '../lib/activitySurface'
import {
  onAttachFilesRequest,
  onAttachPathsRequest,
  onBlankChatRequest,
  onNewChatRequest,
  onOpenConversationRequest
} from '../lib/chatRequests'

const SUGGESTIONS = [
  'Bugünümü planlamama yardım et',
  'Yarın saat 9’da spor yapmamı hatırlat',
  'Listeme market alışverişi ekle'
]

// Belge eklenip bir şey yazılmadan gönderilirse kullanılan istek
const DOCUMENT_PROMPT = 'Bu belgeyi incele ve kısaca özetle.'
// Sabah özeti bildirimine tıklanınca gönderilen istek
const BRIEF_PROMPT = 'Günlük özetimi hazırla.'

// Arama kutusuna yazarken her tuşta sorgu göndermemek için beklenen süre
const SEARCH_DELAY = 150

const loadConversations = (): Promise<Conversation[]> => window.api.conversations.list()
const loadTasks = (): Promise<Task[]> => window.api.tasks.list()
const loadReminders = (): Promise<Reminder[]> => window.api.reminders.list()

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
  const toast = useToast()
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const { data: conversations, error: listError } = useLiveData(loadConversations, 'conversations')
  const { data: tasks } = useLiveData(loadTasks, 'tasks')
  const { data: reminders } = useLiveData(loadReminders, 'reminders')
  const assistantState = useAssistantState()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConversationSearchResult[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState<Streaming | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Silinmek üzere onay bekleyen sohbetin kimliği (null ise onay kutusu kapalı)
  const narrow = useNarrowWindow()
  const [historyOpen, setHistoryOpen] = useState(false)
  useEffect(() => {
    function openHistory(): void {
      if (active) setHistoryOpen(true)
    }
    window.addEventListener('jarvis:open-history', openHistory)
    return () => window.removeEventListener('jarvis:open-history', openHistory)
  }, [active])
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  // Asistanın beklediği onaylar ortak depoda; bu sohbete ait olan burada gösterilir
  const approvals = usePendingApprovals()
  const lastOutcome = useLastOutcome()
  const [activityOutcomes, setActivityOutcomes] = useState(readActivityOutcomes)
  const [finishedReply, setFinishedReply] = useState<{
    conversationId: number
    message: ChatMessage | null
  } | null>(null)
  // Olay dinleyicisi içinde her zaman güncel sohbet kimliğini okumak için
  const activeIdRef = useRef<number | null>(null)
  // Olay dinleyicisi içinden güncel ayarları okumak için
  const settingsRef = useRef<SettingsView | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const followReplyRef = useRef(true)
  const scrollingToLatestRef = useRef(false)
  const [hasNewReply, setHasNewReply] = useState(false)
  const reducedMotion = useReducedMotion()
  // Mesaja eklenecek belgeler ve sürükle-bırak durumu
  const [attachments, setAttachments] = useState<AttachedDocument[]>([])
  const [attaching, setAttaching] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Komut dinleyicisi içinden her zaman güncel send fonksiyonunu çağırmak için
  const sendRef = useRef<(text: string, documents?: AttachedDocument[]) => Promise<void>>(
    async () => {}
  )
  const selectRef = useRef<(id: number) => Promise<void>>(async () => {})
  const attachFilesRef = useRef<(files: File[]) => Promise<void>>(async () => {})
  const attachPathsRef = useRef<(paths: string[]) => Promise<void>>(async () => {})

  // Sayfa her görünür olduğunda ayarları tazele (Ayarlar'da model değişmiş olabilir)
  useEffect(() => {
    if (!active) return
    window.api.settings
      .get()
      .then((loaded) => {
        settingsRef.current = loaded
        setSettings(loaded)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [active])

  // Arama kutusu boşken tüm sohbetler, doluyken eşleşenler listelenir
  useEffect(() => {
    const list = conversations ?? []
    let alive = true
    const timer = setTimeout(
      () => {
        const found = query.trim()
          ? window.api.conversations.search(query)
          : Promise.resolve(list.map((conversation) => ({ conversation, snippet: null })))
        found.then(
          (value) => {
            if (alive) setResults(value)
          },
          () => {}
        )
      },
      query.trim() ? SEARCH_DELAY : 0
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [conversations, query])

  // Ana süreçten parça parça gelen cevabı ve araç kullanımlarını dinle
  useEffect(() => {
    return window.api.chat.onEvent((event) => {
      if (event.type === 'delta') {
        setStreaming((s) =>
          s && s.conversationId === event.conversationId ? { ...s, text: s.text + event.text } : s
        )
        return
      }
      if (event.type === 'approval' || event.type === 'approval-resolved') return
      if (event.type === 'tool') {
        setStreaming((s) =>
          s && s.conversationId === event.conversationId
            ? { ...s, tools: upsertTool(s.tools, event.activity) }
            : s
        )
        return
      }

      // Cevap bitti, durduruldu veya hata oldu
      setFinishedReply({ conversationId: event.conversationId, message: event.message })
      setStreaming((s) => (s?.conversationId === event.conversationId ? null : s))
      if (event.conversationId === activeIdRef.current) {
        const message = event.message
        if (message) setMessages((list) => [...list, message])
        if (event.type === 'error') setError(event.error)
        // Ayar açıksa cevabı sesli oku
        if (event.type === 'done' && settingsRef.current?.speakReplies && message?.content) {
          speakText(message.content)
        }
      }
    })
  }, [])

  const streamingView = streaming && streaming.conversationId === activeId ? streaming : null
  const approvalView = approvals.find((item) => item.conversationId === activeId)?.approval ?? null
  // F0'ın son sonucu, aynı bitiş olayının kalıcı mesaj kimliğine bağlanır. Yeni bir cevap
  // başladığında eski sonucun o cevaba aktarılmaması için finishedReply temizlenir.
  useEffect(() => {
    if (
      !lastOutcome ||
      !finishedReply?.message ||
      lastOutcome.conversationId !== finishedReply.conversationId
    )
      return
    const message = finishedReply.message
    const kind = lastOutcome.kind
    let alive = true
    queueMicrotask(() => {
      if (alive) setActivityOutcomes((current) => rememberActivityOutcome(current, message, kind))
    })
    return () => {
      alive = false
    }
  }, [lastOutcome, finishedReply])
  useEffect(() => saveActivityOutcomes(activityOutcomes), [activityOutcomes])
  // Ekrandaki sohbetin onayı burada görünür; diğer onaylar App'teki genel kartta çıkar
  useEffect(() => {
    setVisibleConversation(active ? activeId : null)
  }, [active, activeId])

  useEffect(() => {
    const scroll = scrollRef.current
    const finishScroll = (): void => {
      scrollingToLatestRef.current = false
    }
    scroll?.addEventListener('scrollend', finishScroll)
    return () => scroll?.removeEventListener('scrollend', finishScroll)
  }, [])

  // Kullanıcı geçmişi okuyorsa yeni yanıt onun konumunu değiştirmez.
  useEffect(() => {
    if (!active) return
    const scroll = scrollRef.current
    if (!scroll) return
    const frame = requestAnimationFrame(() => {
      if (followReplyRef.current) scroll.scrollTop = scroll.scrollHeight
      else if (streamingView || messages.at(-1)?.role === 'assistant') setHasNewReply(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, messages, streamingView, approvalView, activityOutcomes])

  function followLatestReply(): void {
    followReplyRef.current = true
    setHasNewReply(false)
    const scroll = scrollRef.current
    // Uzun geçmişte saniyelerce kayan bir geçiş yerine doğrudan yeni yanıta git.
    scrollingToLatestRef.current =
      !reducedMotion &&
      !streamingView &&
      !!scroll &&
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < scroll.clientHeight
    scroll?.scrollTo({
      top: scroll.scrollHeight,
      behavior: scrollingToLatestRef.current ? 'smooth' : 'instant'
    })
  }

  const openConversation = useCallback((id: number | null): void => {
    activeIdRef.current = id
    setActiveId(id)
    setMessages([])
    setFinishedReply(null)
    followReplyRef.current = true
    scrollingToLatestRef.current = false
    setHasNewReply(false)
    setError(null)
    // Belge izni sohbete bağlı; sohbet değişince eklenen belgeler bırakılır
    setAttachments([])
  }, [])

  // Tepsi menüsündeki "Yeni sohbet" ve sabah özeti bildirimine tıklama komutları
  useEffect(() => {
    return window.api.events.onCommand((command) => {
      if (command === 'new-chat') openConversation(null)
      if (command === 'daily-brief') {
        openConversation(null)
        void sendRef.current(BRIEF_PROMPT, [])
      }
    })
  }, [openConversation])

  // Komut paletinden "Yeni sohbet": metin göndermeden boş sohbet açar
  useEffect(() => onBlankChatRequest(() => openConversation(null)), [openConversation])

  // Ana Sayfa'ya bırakılan belgeler yeni sohbete eklenir
  useEffect(
    () =>
      onAttachFilesRequest((files) => {
        openConversation(null)
        void attachFilesRef.current(files)
      }),
    [openConversation]
  )
  // Çentiğe bırakılan belgeler de yeni sohbete eklenir (yol olarak gelir)
  useEffect(
    () =>
      onAttachPathsRequest((paths) => {
        openConversation(null)
        void attachPathsRef.current(paths)
      }),
    [openConversation]
  )

  // Ana Sayfa'daki komut kutusundan gelen istek yeni sohbette cevaplanır
  useEffect(
    () =>
      onNewChatRequest((text) => {
        openConversation(null)
        void sendRef.current(text, [])
      }),
    [openConversation]
  )

  // Ana Sayfa'daki sesli sohbet kartından "Sohbette aç"
  useEffect(() => onOpenConversationRequest((id) => void selectRef.current(id)), [])

  // Klavye kısayolları: Ctrl+N yeni sohbet, Ctrl+F arama, Esc cevabı durdur
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if ((event.target as HTMLElement | null)?.closest('[aria-modal="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openConversation(null)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        focusConversationSearch()
        return
      }
      if (event.key === 'Escape' && activeIdRef.current !== null) {
        void window.api.chat.stop(activeIdRef.current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, openConversation])

  async function selectConversation(id: number): Promise<void> {
    openConversation(id)
    try {
      setMessages(await window.api.conversations.messages(id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function deleteConversation(id: number): Promise<void> {
    try {
      await window.api.conversations.remove(id)
      setActivityOutcomes((current) => forgetConversationOutcomes(current, id))
      if (activeIdRef.current === id) openConversation(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function renameConversation(id: number, title: string): Promise<void> {
    try {
      await window.api.conversations.rename(id, title)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function pinConversation(id: number, pinned: boolean): Promise<void> {
    try {
      await window.api.conversations.pin(id, pinned)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function exportConversation(id: number): Promise<void> {
    try {
      const path = await window.api.conversations.exportMarkdown(id)
      // Kullanıcı vazgeçtiyse path boş gelir
      if (path) toast.success(`Kaydedildi: ${path.split(/[\\/]/).pop()}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function send(text: string, documents = attachments): Promise<void> {
    const content = composeMessage(text || (documents.length > 0 ? DOCUMENT_PROMPT : ''), documents)
    if (!content) return
    setError(null)
    stopSpeaking()
    try {
      let id = activeIdRef.current
      if (id === null) {
        id = (await window.api.conversations.create()).id
        openConversation(id)
      }
      setAttachments([])
      setStreaming({ conversationId: id, text: '', tools: [] })
      setFinishedReply(null)
      noteReplyStarted(id)
      const userMessage = await window.api.chat.send(id, content)
      setMessages((list) => [...list, userMessage])
    } catch (err) {
      setStreaming(null)
      if (activeIdRef.current !== null) noteReplyFailed(activeIdRef.current)
      // Gönderilemediyse belgeler kaybolmasın
      setAttachments(documents)
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    sendRef.current = send
    selectRef.current = selectConversation
    attachFilesRef.current = attachFiles
    attachPathsRef.current = attachPaths
  })

  // Sürüklenen veya seçilen belgeleri okuyup mesaja eklenmek üzere bekletir
  async function attachFiles(files: File[]): Promise<void> {
    const paths: string[] = []
    for (const file of files) {
      const path = window.api.documents.pathForFile(file)
      if (path) paths.push(path)
      else toast.error(`${file.name} okunamadı.`)
    }
    await attachPaths(paths)
  }

  async function attachPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    setAttaching(true)
    try {
      let id = activeIdRef.current
      if (id === null) {
        id = (await window.api.conversations.create()).id
        openConversation(id)
      }
      for (const path of paths) {
        const name = path.split(/[\\/]/).pop() ?? path
        try {
          const doc = await window.api.documents.read(id, path)
          // Bu arada başka sohbete geçildiyse belge oraya eklenmez
          if (activeIdRef.current !== id) return
          setAttachments((list) => (list.some((d) => d.path === doc.path) ? list : [...list, doc]))
        } catch (err) {
          toast.error(`${name}: ${errorMessage(err)}`)
        }
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setAttaching(false)
    }
  }

  // Son cevabı sil ve aynı soruyu modele yeniden sordur
  async function regenerate(): Promise<void> {
    const id = activeIdRef.current
    if (id === null) return
    setError(null)
    stopSpeaking()
    const previous = messages
    setMessages((list) => list.slice(0, -1))
    setStreaming({ conversationId: id, text: '', tools: [] })
    setFinishedReply(null)
    try {
      await window.api.chat.regenerate(id)
    } catch (err) {
      setStreaming(null)
      setMessages(previous)
      setError(errorMessage(err))
    }
  }

  // Bir kullanıcı mesajını değiştir; o noktadan sonrası silinip sohbet yeniden yazılır
  async function editMessage(messageId: number, text: string): Promise<void> {
    const id = activeIdRef.current
    if (id === null) return
    setError(null)
    stopSpeaking()
    const previous = messages
    setMessages((list) => list.filter((m) => m.id < messageId))
    setStreaming({ conversationId: id, text: '', tools: [] })
    setFinishedReply(null)
    try {
      const userMessage = await window.api.chat.editAndResend(id, messageId, text)
      setMessages((list) => [...list, userMessage])
    } catch (err) {
      setStreaming(null)
      setMessages(previous)
      setError(errorMessage(err))
    }
  }

  const modelName = settings ? settings.models[settings.provider] : ''
  const modelReady =
    !!settings &&
    modelName !== '' &&
    (settings.provider === 'ollama' || settings.hasSecret[settings.provider])
  const activeConversation = (conversations ?? []).find((c) => c.id === activeId)
  const activeTitle = activeConversation?.title || 'Yeni sohbet'
  const showEmptyState =
    messages.length === 0 &&
    streamingView === null &&
    !approvalView &&
    !(finishedReply?.conversationId === activeId && finishedReply.message === null)
  const lastMessage = messages[messages.length - 1]
  const canRegenerate = !streamingView && lastMessage?.role === 'assistant'
  const summary =
    tasks && reminders ? buildHomeSummary({ tasks, reminders, now: new Date() }) : null

  return (
    <div className="flex h-full">
      {narrow ? (
        <HistoryDrawer open={active && historyOpen} onClose={() => setHistoryOpen(false)}>
          <ConversationList
            drawer
            results={results}
            activeId={activeId}
            query={query}
            onQueryChange={setQuery}
            onSelect={(id) => {
              setHistoryOpen(false)
              void selectConversation(id)
            }}
            onNew={() => {
              setHistoryOpen(false)
              openConversation(null)
            }}
            onDelete={(id) => setPendingDeleteId(id)}
            onRename={(id, title) => void renameConversation(id, title)}
            onPin={(id, pinned) => void pinConversation(id, pinned)}
            onExport={(id) => void exportConversation(id)}
          />
        </HistoryDrawer>
      ) : (
        <ConversationList
          results={results}
          activeId={activeId}
          query={query}
          onQueryChange={setQuery}
          onSelect={(id) => {
            setHistoryOpen(false)
            void selectConversation(id)
          }}
          onNew={() => {
            setHistoryOpen(false)
            openConversation(null)
          }}
          onDelete={(id) => setPendingDeleteId(id)}
          onRename={(id, title) => void renameConversation(id, title)}
          onPin={(id, pinned) => void pinConversation(id, pinned)}
          onExport={(id) => void exportConversation(id)}
        />
      )}

      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (modelReady) void attachFiles(Array.from(e.dataTransfer.files))
        }}
      >
        {dragging && (
          <div className="animate-fade pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-card border-2 border-dashed border-accent/60 bg-app/85">
            <div className="text-center">
              <FileUp className="mx-auto h-8 w-8 text-accent" />
              <p className="mt-2 text-sm font-medium text-ink">
                {modelReady ? 'Belgeyi buraya bırak' : "Önce Ayarlar'dan bir model seç"}
              </p>
              <p className="mt-0.5 text-xs text-muted">PDF, Word veya metin dosyası</p>
            </div>
          </div>
        )}

        <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2">
            {narrow && (
              <button
                onClick={() => setHistoryOpen(true)}
                aria-label="Sohbet geçmişini aç"
                className="min-h-8 min-w-8 rounded-control text-muted hover:bg-surface"
              >
                <History className="mx-auto h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <Orb state={assistantState} size={28} />
            <h1 className="truncate text-sm font-medium text-ink">{activeTitle}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeConversation && (
              <button
                onClick={() => void exportConversation(activeConversation.id)}
                aria-label="Sohbeti dışa aktar"
                title="Markdown olarak kaydet"
                className={quietIconButtonClass}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            {settings &&
              (modelReady ? (
                <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
                  {PROVIDERS[settings.provider].label} · {modelName}
                </span>
              ) : (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 rounded-full bg-caution/10 px-3 py-1 text-xs text-caution transition-colors hover:bg-caution/20"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Model seçilmedi, Ayarlar&apos;a git
                </button>
              ))}
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          onWheel={() => {
            scrollingToLatestRef.current = false
          }}
          onTouchStart={() => {
            scrollingToLatestRef.current = false
          }}
          onScroll={(event) => {
            if (scrollingToLatestRef.current) return
            const nearEnd = isNearScrollEnd(event.currentTarget)
            followReplyRef.current = nearEnd
            if (nearEnd) setHasNewReply(false)
          }}
        >
          {showEmptyState ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <Orb state={assistantState} size={120} />
              <h2 className="text-2xl font-semibold tracking-tight">
                {greeting(new Date().getHours())}
              </h2>
              <p className="max-w-md text-sm text-muted">
                {modelReady
                  ? (summary ??
                    'Sohbet edebilir, görev ve hatırlatma ekletebilir, not tutturabilirsin.')
                  : "Başlamak için Ayarlar'dan bir yapay zeka modeli seç."}
              </p>
              {modelReady && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => void send(suggestion)}
                      disabled={streaming !== null}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-6">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  tools={message.tools}
                  outcome={message.outcome ?? activityOutcomes[activityRecordKey(message)]}
                  onEdit={
                    message.role === 'user' && !streamingView
                      ? (text) => void editMessage(message.id, text)
                      : undefined
                  }
                  onRegenerate={
                    canRegenerate && index === messages.length - 1
                      ? () => void regenerate()
                      : undefined
                  }
                />
              ))}
              {streamingView && (
                <MessageBubble
                  role="assistant"
                  content={streamingView.text}
                  tools={streamingView.tools}
                  pending
                  approval={approvalView}
                  onRespond={
                    approvalView
                      ? (approved) => respondToApproval(approvalView.id, approved)
                      : undefined
                  }
                  onStop={() => window.api.chat.stop(streamingView.conversationId)}
                />
              )}
              {!streamingView && approvalView && (
                <ActivitySurface
                  tools={[]}
                  pending
                  approval={approvalView}
                  onRespond={(approved) => respondToApproval(approvalView.id, approved)}
                  onStop={activeId !== null ? () => window.api.chat.stop(activeId) : undefined}
                />
              )}
              {!streamingView &&
                !approvalView &&
                finishedReply?.message === null &&
                lastOutcome?.conversationId === activeId && (
                  <ActivitySurface tools={[]} outcome={lastOutcome.kind} />
                )}
            </div>
          )}

          {(error || listError) && (
            <div className="mx-auto w-full max-w-3xl px-5 pb-4">
              <div className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative select-text">
                {error ?? listError}
              </div>
            </div>
          )}
        </div>

        {hasNewReply && (
          <div className="pointer-events-none relative z-10 h-0">
            <button
              onClick={followLatestReply}
              className="pointer-events-auto absolute bottom-3 left-1/2 flex min-h-8 -translate-x-1/2 items-center gap-2 rounded-control border border-line-strong bg-elevated px-3 py-1.5 text-xs text-ink shadow-float"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Yeni yanıt
            </button>
          </div>
        )}

        <Composer
          busy={streaming !== null}
          disabled={!modelReady}
          attachments={attachments}
          attaching={attaching}
          onAttachFiles={(files) => void attachFiles(files)}
          onRemoveAttachment={(path) =>
            setAttachments((list) => list.filter((doc) => doc.path !== path))
          }
          onSend={(text) => void send(text)}
          onStop={() => {
            if (streaming) void window.api.chat.stop(streaming.conversationId)
          }}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Bu sohbet silinsin mi?"
        tone="danger"
        confirmLabel="Sil"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (id !== null) void deleteConversation(id)
        }}
      />
    </div>
  )
}

export default ChatPage
