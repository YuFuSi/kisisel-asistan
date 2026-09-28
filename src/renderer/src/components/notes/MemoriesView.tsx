import { useEffect, useState } from 'react'
import { Brain, Check, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import {
  MEMORY_KIND_LABELS,
  MEMORY_KINDS,
  type Memory,
  type MemoryKind,
  type SettingsView
} from '@shared/api'
import Button from '../ui/Button'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import {
  iconButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass
} from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadMemories = (): Promise<Memory[]> => window.api.memories.list()
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()

// Yazmayı bıraktıktan bu kadar süre sonra arama gönderilir
const SEARCH_DELAY_MS = 400

interface MemoriesViewProps {
  /** "Şu sohbetten öğrenildi" bağlantısı: sohbet sayfasında o sohbeti açar */
  onOpenConversation?: (conversationId: number) => void
}

function MemoriesView({ onOpenConversation }: MemoriesViewProps): React.JSX.Element {
  const memories = useLiveData(loadMemories, 'memories')
  const [processing, setProcessing] = useState(false)
  const settings = useLiveData(loadSettings, 'settings')
  const [draft, setDraft] = useState('')
  // Düzenlenen kayıt ve yeni metni
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null)
  const [searching, setSearching] = useState(false)
  const toast = useToast()
  const error = memories.error

  // memories:search hem anlamsal hem (ayar kapalıysa) anahtar kelime aramasını kendi içinde
  // yönetir; burada tek yapılacak sorguyu durulunca göndermek.
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    let active = true
    const timer = setTimeout(() => {
      setSearching(true)
      window.api.memories
        .search(trimmed)
        .then(
          (results) => {
            if (active) setSearchResults(results)
          },
          (err: unknown) => {
            if (active) {
              toast.error(errorMessage(err))
              setSearchResults(null)
            }
          }
        )
        .finally(() => {
          if (active) setSearching(false)
        })
    }, SEARCH_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery, toast])

  const isSearching = searchQuery.trim().length > 0
  const displayedMemories = isSearching ? (searchResults ?? []) : (memories.data ?? [])

  async function backfillEmbeddings(): Promise<void> {
    setIndexing(true)
    try {
      const count = await window.api.memories.backfillEmbeddings()
      toast.success(
        count === 0 ? 'Zaten güncel, indekslenecek kayıt yok.' : `${count} kayıt indekslendi.`
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setIndexing(false)
    }
  }

  // Otomatik öğrenilip henüz bakılmamış kayıtlar ("yeni öğrendiklerim")
  const unreviewed = (memories.data ?? []).filter((memory) => !memory.reviewed)

  async function processNow(): Promise<void> {
    setProcessing(true)
    try {
      const result = await window.api.memories.processNow()
      if (result.conversations === 0) {
        toast.success('İşlenecek yeni konuşma yok, hafıza güncel.')
      } else {
        const learned = result.added + result.updated
        toast.success(
          `${result.conversations} konuşma işlendi` +
            (learned > 0 ? `, ${result.added} yeni bilgi öğrenildi.` : ', yeni bilgi çıkmadı.') +
            (result.remaining > 0 ? ` ${result.remaining} konuşma sonraya kaldı.` : '')
        )
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.trim()) return
    if (await run(() => window.api.memories.create(draft))) setDraft('')
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return
    const current = memories.data?.find((m) => m.id === editing.id)
    const text = editing.text.trim()
    setEditing(null)
    if (!text || text === current?.content) return
    await run(() => window.api.memories.update(editing.id, text))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <p className="text-sm text-muted">
          Jarvis buradaki bilgileri hangi model seçili olursa olsun her sohbette hatırlar.
          Konuşmalarından önemli bilgileri kendisi de çıkarır (bilgisayarında, yerel modelle); çok
          benzer bir bilgi zaten varsa yenisiyle güncellenir. Bir bilgiye tıklayarak düzeltebilir,
          türünü değiştirebilir veya silebilirsin. &quot;Profil&quot; türündekiler her sohbette
          mutlaka hatırlanır.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <p className="text-sm text-muted">
            Konuşmalar, bilgisayarı birkaç dakika kullanmadığında kendiliğinden işlenir.
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={Sparkles}
            loading={processing}
            onClick={() => void processNow()}
          >
            Şimdi işle
          </Button>
        </div>

        {unreviewed.length > 0 && !isSearching && (
          <section className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                <Sparkles className="h-4 w-4 text-accent" />
                Yeni öğrendiklerim ({unreviewed.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                icon={Check}
                onClick={() => void run(() => window.api.memories.markReviewed())}
              >
                Hepsi doğru
              </Button>
            </div>
            <p className="text-xs text-muted">
              Konuşmalarından çıkardığım bilgiler. Yanlış olanı düzelt veya sil; doğruysa onayla.
            </p>
            <ul className="space-y-1">
              {unreviewed.map((memory) => (
                <li key={memory.id} className="flex items-center gap-2 text-sm text-ink">
                  <span className="min-w-0 flex-1">{memory.content}</span>
                  <button
                    onClick={() => void run(() => window.api.memories.markReviewed([memory.id]))}
                    aria-label="Doğru, onayla"
                    title="Doğru"
                    className="rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-positive"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {settings.data?.semanticSearchEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
            <p className="text-sm text-muted">
              Anlamsal arama açık. Mevcut kayıtların hâlâ indekslenmemiş olabilir.
            </p>
            <button
              onClick={() => void backfillEmbeddings()}
              disabled={indexing}
              className={secondaryButtonClass}
            >
              {indexing ? 'İndeksleniyor...' : 'İndeksle'}
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              settings.data?.semanticSearchEnabled ? 'Anlamıyla ara...' : 'Hafızada ara...'
            }
            style={{ paddingLeft: '2.25rem' }}
            className={inputClass}
          />
        </div>
        {searching && <p className="px-1 text-xs text-faint">Aranıyor...</p>}

        <form onSubmit={(e) => void add(e)} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ör. Kahvemi şekersiz içerim"
            maxLength={300}
            className={inputClass}
          />
          <button type="submit" disabled={!draft.trim()} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </form>

        {memories.data && displayedMemories.length === 0 && (
          <p className="px-1 py-2 text-sm text-faint">
            {isSearching ? 'Eşleşen kayıt yok.' : 'Henüz kayıtlı bilgi yok.'}
          </p>
        )}
        <ul className="space-y-1">
          {displayedMemories.map((memory) =>
            editing?.id === memory.id ? (
              <li key={memory.id} className="px-1 py-1">
                <input
                  autoFocus
                  value={editing.text}
                  maxLength={300}
                  onChange={(e) => setEditing({ id: memory.id, text: e.target.value })}
                  onBlur={() => void saveEdit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  aria-label="Hafıza kaydını düzenle"
                  className={inputClass}
                />
              </li>
            ) : (
              <li
                key={memory.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface"
              >
                <Brain className="h-4 w-4 shrink-0 text-accent" />
                <select
                  value={memory.kind}
                  onChange={(e) =>
                    void run(() =>
                      window.api.memories.setKind(memory.id, e.target.value as MemoryKind)
                    )
                  }
                  aria-label="Bilginin türü"
                  title="Tür"
                  className="shrink-0 rounded-md border border-line bg-transparent px-1.5 py-0.5 text-xs text-muted outline-none hover:border-line-strong focus:border-accent/70"
                >
                  {MEMORY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {MEMORY_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setEditing({ id: memory.id, text: memory.content })}
                  title="Düzenlemek için tıkla"
                  className="min-w-0 flex-1 text-left text-sm text-ink"
                >
                  {memory.content}
                </button>
                {memory.sourceConversationId !== null && onOpenConversation && (
                  <button
                    onClick={() => onOpenConversation(memory.sourceConversationId!)}
                    aria-label="Öğrenildiği sohbeti aç"
                    title="Bu bilgiyi öğrendiğim sohbeti aç"
                    className={iconButtonClass}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditing({ id: memory.id, text: memory.content })}
                  aria-label="Bilgiyi düzenle"
                  title="Düzenle"
                  className={iconButtonClass}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void run(() => window.api.memories.remove(memory.id))}
                  aria-label="Bilgiyi sil"
                  title="Sil"
                  className={`${iconButtonClass} hover:text-negative`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          )}
        </ul>

        {error && <p className="text-sm text-negative select-text">{error}</p>}
      </div>
    </div>
  )
}

export default MemoriesView
