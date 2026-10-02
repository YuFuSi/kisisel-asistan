import { useRef, useState } from 'react'
import { FileText, Loader2, Mic, Paperclip, SendHorizontal, Square, X } from 'lucide-react'
import type { AttachedDocument } from '@shared/api'
import { COMPOSER_INPUT_ID } from '../../lib/dom'
import { useDictation } from '../../lib/useDictation'

interface ComposerProps {
  busy: boolean
  disabled: boolean
  /** Gönderilecek mesaja eklenmiş belgeler */
  attachments: AttachedDocument[]
  /** Belge okunurken true */
  attaching: boolean
  onSend: (text: string) => void
  onStop: () => void
  onAttachFiles: (files: File[]) => void
  onRemoveAttachment: (path: string) => void
}

const MAX_HEIGHT = 200
// Dosya seçme penceresinde gösterilen türler (ana süreçteki SUPPORTED_EXTENSIONS ile aynı)
const ACCEPTED_FILES = '.pdf,.docx,.txt,.md,.csv,.json,.log'

const iconButtonClass =
  'inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong'

function Composer({
  busy,
  disabled,
  attachments,
  attaching,
  onSend,
  onStop,
  onAttachFiles,
  onRemoveAttachment
}: ComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Mikrofon: konuşulan metin kutudaki yazının sonuna eklenir, gönderilmez
  const dictation = useDictation((spoken) => {
    setText((previous) => (previous ? `${previous} ${spoken}` : spoken))
    requestAnimationFrame(() => {
      resize()
      textareaRef.current?.focus()
    })
  })

  const canSend = !busy && !disabled && !attaching && (text.trim() !== '' || attachments.length > 0)

  // Yazı uzadıkça kutu büyüsün (en fazla MAX_HEIGHT)
  function resize(): void {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  function submit(): void {
    if (!canSend) return
    onSend(text.trim())
    setText('')
    requestAnimationFrame(resize)
  }

  return (
    <div className="shrink-0 p-4">
      <div className="glass mx-auto max-w-3xl px-4 py-3 transition-shadow focus-within:ring-2 focus-within:ring-accent/20">
        {(attachments.length > 0 || attaching) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((doc) => (
              <span
                key={doc.path}
                title={doc.path}
                className="glass-soft animate-fade inline-flex min-w-0 max-w-full items-center gap-1.5 py-1 pr-1 pl-2 text-xs text-ink"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 truncate">{doc.name}</span>
                {doc.partCount > 1 && (
                  <span className="shrink-0 text-faint">{doc.partCount} parça</span>
                )}
                <button
                  onClick={() => onRemoveAttachment(doc.path)}
                  aria-label={`${doc.name} belgesini kaldır`}
                  className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded p-0.5 text-faint transition-colors hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {attaching && (
              <span className="inline-flex items-center gap-1.5 px-1 py-1 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Belge okunuyor...
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attaching}
            aria-label="Belge ekle"
            title="Belge ekle (PDF, Word, metin) — sürükleyip bırakabilirsin de"
            className={iconButtonClass}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              // Aynı dosya tekrar seçilebilsin
              e.target.value = ''
              if (files.length > 0) onAttachFiles(files)
            }}
          />
          <textarea
            id={COMPOSER_INPUT_ID}
            ref={textareaRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              setText(e.target.value)
              resize()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={
              disabled
                ? "Önce Ayarlar'dan bir model seç"
                : attachments.length > 0
                  ? 'Belge hakkında ne sormak istersin? (Boş bırakırsan özetlenir)'
                  : 'Bir mesaj yaz... (Shift+Enter: yeni satır)'
            }
            style={{ maxHeight: MAX_HEIGHT }}
            className="min-w-0 flex-1 resize-none bg-transparent py-0.5 text-sm leading-6 outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          <button
            onClick={() => void dictation.toggle()}
            disabled={disabled || dictation.transcribing}
            aria-label={dictation.recording ? 'Kaydı bitir' : 'Sesli yaz'}
            title={dictation.recording ? 'Kaydı bitir ve yazıya çevir' : 'Mikrofonla yaz'}
            className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:text-line-strong ${
              dictation.recording
                ? 'bg-negative text-app hover:bg-negative'
                : 'text-muted hover:text-ink'
            }`}
          >
            {dictation.transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className={`h-4 w-4 ${dictation.recording ? 'animate-pulse' : ''}`} />
            )}
          </button>
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Durdur"
              title="Durdur"
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-line-strong p-1.5 text-ink transition-colors hover:bg-line-strong"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              aria-label="Gönder"
              title="Gönder"
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-accent p-1.5 text-app transition-colors hover:bg-accent-hover disabled:bg-transparent disabled:text-faint"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {(dictation.recording || dictation.transcribing || dictation.error) && (
        <div className="mx-auto mt-2 max-w-3xl text-xs">
          {dictation.recording && (
            <span className="text-negative">Dinliyorum... Bitirmek için mikrofona tekrar bas.</span>
          )}
          {dictation.transcribing && <span className="text-muted">Yazıya çevriliyor...</span>}
          {dictation.error && <span className="text-negative select-text">{dictation.error}</span>}
        </div>
      )}
    </div>
  )
}

export default Composer
