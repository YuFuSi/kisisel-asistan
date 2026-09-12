import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, FileText, Loader2, Pencil, RotateCcw, Volume2, X } from 'lucide-react'
import type { ChatRole, ToolActivity, ToolStatus } from '@shared/api'
import { splitAttachments } from '@shared/attachments'
import CodeBlock from './CodeBlock'
import { speakText } from '../../lib/voice'
import { primaryButtonClass, secondaryButtonClass } from '../../lib/styles'

interface MessageBubbleProps {
  role: ChatRole
  content: string
  tools?: ToolActivity[]
  pending?: boolean
  /** Sesli okuma için seçili Windows sesi */
  voiceUri?: string
  /** Verilirse asistan cevabının altında "yeniden üret" düğmesi çıkar */
  onRegenerate?: () => void
  /** Verilirse kullanıcı mesajı düzenlenebilir */
  onEdit?: (text: string) => void
}

const STATUS_TEXT: Record<ToolStatus, string> = {
  running: 'çalışıyor',
  done: 'tamamlandı',
  error: 'başarısız'
}

const actionButtonClass =
  'rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink'

function TypingDots(): React.JSX.Element {
  return (
    <div className="flex h-6 items-center gap-1" aria-label="Yazıyor">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

// Asistanın kullandığı araçlar: "✓ Görev ekleme" gibi küçük etiketler
function ToolChips({ tools }: { tools: ToolActivity[] }): React.JSX.Element {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <span
          key={tool.id}
          title={`${tool.label}: ${STATUS_TEXT[tool.status]}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
            tool.status === 'error'
              ? 'border-negative/30 bg-negative/10 text-negative'
              : 'border-line bg-elevated text-muted'
          }`}
        >
          {tool.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
          {tool.status === 'done' && <Check className="h-3 w-3 text-positive" />}
          {tool.status === 'error' && <X className="h-3 w-3" />}
          {tool.label}
        </span>
      ))}
    </div>
  )
}

function MessageBubble({
  role,
  content,
  tools = [],
  pending = false,
  voiceUri = '',
  onRegenerate,
  onEdit
}: MessageBubbleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)

  async function copyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Pano kullanılamıyorsa sessizce geç
    }
  }

  // Kullanıcı mesajındaki belge blokları kart olarak gösterilir; düzenlerken sadece metin değişir
  const { text: userText, documents } = splitAttachments(content)
  const blockStart = content.indexOf('[[BELGE ')
  const attachmentPart = blockStart === -1 ? '' : content.slice(blockStart)

  function saveEdit(): void {
    const text = (draft ?? '').trim()
    setDraft(null)
    const full = [text, attachmentPart].filter((part) => part !== '').join('\n\n')
    if (full && full !== content) onEdit?.(full)
  }

  if (role === 'user') {
    if (draft !== null) {
      return (
        <div className="animate-enter flex justify-end">
          <div className="w-full max-w-[80%] rounded-2xl border border-accent/40 bg-accent/10 p-3">
            <textarea
              autoFocus
              rows={Math.min(10, draft.split('\n').length + 1)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setDraft(null)
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
              }}
              aria-label="Mesajı düzenle"
              className="w-full resize-none bg-transparent text-sm leading-6 text-ink outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className={`${secondaryButtonClass} py-1.5`}>
                Vazgeç
              </button>
              <button onClick={saveEdit} className={`${primaryButtonClass} py-1.5`}>
                Gönder
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="group/message animate-enter flex items-start justify-end gap-1">
        {onEdit && (
          <button
            onClick={() => setDraft(userText)}
            aria-label="Mesajı düzenle"
            title="Düzenle ve yeniden gönder"
            className={`${actionButtonClass} mt-1 opacity-0 group-hover/message:opacity-100 focus:opacity-100`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-accent/30 bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap text-ink select-text">
          {documents.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${userText ? 'mb-2' : ''}`}>
              {documents.map((doc, index) => (
                <span
                  key={`${doc.name}-${index}`}
                  className="inline-flex max-w-64 items-center gap-1.5 rounded-lg border border-accent/30 bg-app/40 px-2 py-1 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate">{doc.name}</span>
                  {doc.partCount > 1 && (
                    <span className="shrink-0 text-faint">{doc.partCount} parça</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {userText}
        </div>
      </div>
    )
  }

  return (
    <div className="group/message animate-enter flex justify-start">
      <div className="w-full min-w-0">
        {tools.length > 0 && <ToolChips tools={tools} />}

        {content ? (
          <div className="prose prose-sm max-w-none prose-invert select-text prose-p:leading-7 prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                pre: ({ children }) => <CodeBlock>{children}</CodeBlock>
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          pending && <TypingDots />
        )}

        {content && !pending && (
          <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100">
            <button
              onClick={() => void copyContent()}
              aria-label="Cevabı kopyala"
              title="Kopyala"
              className={actionButtonClass}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-positive" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => speakText(content, voiceUri)}
              aria-label="Cevabı sesli oku"
              title="Sesli oku"
              className={actionButtonClass}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                aria-label="Cevabı yeniden üret"
                title="Yeniden üret"
                className={actionButtonClass}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
