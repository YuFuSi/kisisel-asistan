import { useEffect, useState } from 'react'
import {
  Brain,
  CalendarClock,
  Check,
  Heart,
  Lightbulb,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  Users
} from 'lucide-react'
import { motion } from 'motion/react'
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
import { iconButtonClass, primaryButtonClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'
import { useReducedMotion } from '../../lib/useReducedMotion'
import IconTile, { type IconTone } from '../ui/IconTile'
import { inputClass, rowTransition } from './styles'

const kindTiles = {
  profil: { icon: User, tone: 'pink' },
  tercih: { icon: Heart, tone: 'pink' },
  plan: { icon: CalendarClock, tone: 'blue' },
  kisi: { icon: Users, tone: 'pink' },
  olay: { icon: CalendarClock, tone: 'blue' },
  bilgi: { icon: Lightbulb, tone: 'teal' }
} satisfies Record<MemoryKind, { icon: typeof User; tone: IconTone }>

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
  const reduced = useReducedMotion()
  const memories = useLiveData(loadMemories, 'memories')
  const [processing, setProcessing] = useState(false)
  const settings = useLiveData(loadSettings, 'settings')
  const [draft, setDraft] = useState('')
  // Düzenlenen kayıt ve yeni metni
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
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
  const groups = ['profil', 'tercih', 'plan', 'kisi', 'olay', 'bilgi']
    .map((kind) => ({
      kind: kind as MemoryKind,
      items: displayedMemories.filter((memory) => memory.kind === kind)
    }))
    .filter((group) => group.items.length)
  const sourceLabels = {
    otomatik: 'Konuşmadan öğrenildi',
    kullanici: 'Sen ekledin',
    arac: 'Pıtır kaydetti'
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
    if (!text) return
    if (
      text === current?.content ||
      (await run(() => window.api.memories.update(editing.id, text)))
    )
      setEditing(null)
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* PageLayout'un başlık çerçevesiyle aynı genişlik ve kenar boşluğu (başlıkla hizalı) */}
      <div className="mx-auto w-full max-w-4xl space-y-5 px-8 py-6">
        <section className="glass min-w-0 space-y-4 p-5">
          <h2 className="flex items-center gap-3 text-sm font-semibold text-ink">
            <IconTile icon={Brain} tone="lilac" size={30} />
            Pıtır&apos;in bildikleri
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            Pıtır buradaki bilgileri hangi model seçili olursa olsun her sohbette hatırlar.
            Konuşmalarından önemli bilgileri kendisi de çıkarır (bilgisayarında, yerel modelle); çok
            benzer bir bilgi zaten varsa yenisiyle güncellenir. Bir bilgiye tıklayarak düzeltebilir,
            türünü değiştirebilir veya silebilirsin. &quot;Profil&quot; türündekiler her sohbette
            mutlaka hatırlanır.
          </p>

          <div className="glass-soft flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-muted">
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
        </section>

        {unreviewed.length > 0 && !isSearching && (
          <section className="glass min-w-0 space-y-3 p-5 ring-1 ring-accent/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
                <IconTile icon={Sparkles} tone="lilac" size={28} />
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
            <ul className="space-y-2">
              {unreviewed.map((memory) => (
                <motion.li
                  key={memory.id}
                  layout={!reduced}
                  initial={false}
                  transition={rowTransition}
                  className="glass-soft flex items-center gap-2 px-3 py-2 text-sm text-ink"
                >
                  <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                    {memory.content}
                  </span>
                  <button
                    onClick={() => setEditing({ id: memory.id, text: memory.content })}
                    className="min-h-8 rounded-control px-2 text-xs text-muted hover:bg-elevated"
                  >
                    Düzelt
                  </button>
                  <button
                    onClick={() => void run(() => window.api.memories.markReviewed([memory.id]))}
                    aria-label="Doğru, onayla"
                    title="Doğru"
                    className="min-h-8 min-w-8 rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-positive"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        <div className="glass min-w-0 space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              aria-label="Hafızada ara"
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

          <form onSubmit={(e) => void add(e)} className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 basis-48">
              <input
                aria-label="Yeni bilgi"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ör. Kahvemi şekersiz içerim"
                maxLength={300}
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={!draft.trim()} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Ekle
            </button>
          </form>
        </div>

        {memories.data && displayedMemories.length === 0 && (
          <p className="px-1 py-2 text-sm text-faint">
            {isSearching ? 'Eşleşen kayıt yok.' : 'Henüz kayıtlı bilgi yok.'}
          </p>
        )}
        <ul className="space-y-5">
          {groups.map((group) => (
            <li key={group.kind} className="glass min-w-0 p-5">
              <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold text-ink">
                <IconTile
                  icon={kindTiles[group.kind].icon}
                  tone={kindTiles[group.kind].tone}
                  size={28}
                />
                {MEMORY_KIND_LABELS[group.kind]} · {group.items.length}
              </h2>
              <ul className="space-y-2">
                {group.items.map((memory) =>
                  editing?.id === memory.id ? (
                    <motion.li
                      key={memory.id}
                      layout={!reduced}
                      initial={false}
                      transition={rowTransition}
                      className="glass-soft min-w-0 p-3"
                    >
                      <input
                        autoFocus
                        value={editing.text}
                        maxLength={300}
                        onChange={(e) => setEditing({ id: memory.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveEdit()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        aria-label="Hafıza kaydını düzenle"
                        className={inputClass}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => void saveEdit()}>
                          Kaydet
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                          Vazgeç
                        </Button>
                      </div>
                    </motion.li>
                  ) : (
                    <motion.li
                      key={memory.id}
                      layout={!reduced}
                      initial={false}
                      transition={rowTransition}
                      className="glass-soft group flex flex-wrap items-center gap-3 px-3 py-3 transition-colors hover:bg-white/[0.06]"
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
                        className="min-w-0 shrink-0 rounded-lg border border-line bg-white/5 px-2 py-1 text-xs text-muted outline-none hover:border-line-strong focus:border-accent"
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
                        <span className="block break-words [overflow-wrap:anywhere]">
                          {memory.content}
                        </span>
                        <span className="mt-1 block text-xs text-faint">
                          {sourceLabels[memory.source]}
                          {memory.sourceConversationId !== null
                            ? ` · Sohbet #${memory.sourceConversationId}`
                            : ''}
                          {!memory.reviewed ? ' · Yeni' : ''}
                        </span>
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
                    </motion.li>
                  )
                )}
              </ul>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-negative select-text">{error}</p>}
      </div>
    </div>
  )
}

export default MemoriesView
