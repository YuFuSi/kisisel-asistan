import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, FileText, Pencil, RotateCcw, Volume2 } from 'lucide-react'
import type { ChatRole, ToolActivity, ToolApproval } from '@shared/api'
import type { OutcomeKind } from '../../lib/outcome'
import { splitAttachments } from '@shared/attachments'
import CodeBlock from './CodeBlock'
import ActivitySurface from './ActivitySurface'
import { speakText } from '../../lib/voice'
import { buttonClass } from '../../lib/styles'

interface MessageBubbleProps {
  role: ChatRole
  content: string
  tools?: ToolActivity[]
  pending?: boolean
  outcome?: OutcomeKind
  approval?: ToolApproval | null
  onRespond?: (approved: boolean) => void
  onStop?: () => Promise<void>
  /** Verilirse asistan cevabının altında "yeniden üret" düğmesi çıkar */
  onRegenerate?: () => void
  /** Verilirse kullanıcı mesajı düzenlenebilir */
  onEdit?: (text: string) => void
}

const actionButtonClass =
  'inline-flex min-h-8 min-w-8 items-center justify-center rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink'

function MessageBubble({
  role,
  content,
  tools = [],
  pending = false,
  outcome,
  approval,
  onRespond,
  onStop,
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
          <div className="glass-soft w-full min-w-0 max-w-[80%] p-3 ring-1 ring-accent/30">
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
              <button onClick={() => setDraft(null)} className={buttonClass('secondary', 'sm')}>
                Vazgeç
              </button>
              <button onClick={saveEdit} className={buttonClass('primary', 'sm')}>
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
        <div className="glass-soft min-w-0 max-w-[80%] px-4 py-3 text-sm whitespace-pre-wrap text-ink ring-1 ring-accent/20 select-text [overflow-wrap:anywhere]">
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
      <div className="glass-soft w-full min-w-0 p-4">
        {(tools.length > 0 || pending || approval || (outcome && outcome !== 'completed')) && (
          <ActivitySurface
            tools={tools}
            pending={pending}
            outcome={outcome}
            approval={approval}
            onRespond={onRespond}
            onStop={onStop}
          />
        )}

        {content ? (
          <div className="prose prose-sm max-w-none prose-invert select-text prose-p:leading-7 prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none [overflow-wrap:anywhere]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
                table: ({ children }) => (
                  <div className="max-w-full overflow-x-auto">
                    <table>{children}</table>
                  </div>
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : null}

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
              onClick={() => speakText(content)}
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
