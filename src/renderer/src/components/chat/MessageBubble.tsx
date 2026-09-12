import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, Loader2, Volume2, X } from 'lucide-react'
import type { ChatRole, ToolActivity, ToolStatus } from '@shared/api'
import CodeBlock from './CodeBlock'
import { speakText } from '../../lib/voice'

interface MessageBubbleProps {
  role: ChatRole
  content: string
  tools?: ToolActivity[]
  pending?: boolean
  /** Sesli okuma için seçili Windows sesi */
  voiceUri?: string
}

const STATUS_TEXT: Record<ToolStatus, string> = {
  running: 'çalışıyor',
  done: 'tamamlandı',
  error: 'başarısız'
}

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
  voiceUri = ''
}: MessageBubbleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  async function copyContent(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Pano kullanılamıyorsa sessizce geç
    }
  }

  if (role === 'user') {
    return (
      <div className="animate-enter flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-accent/30 bg-accent/15 px-4 py-2.5 text-sm whitespace-pre-wrap text-ink select-text">
          {content}
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
              className="rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink"
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
              className="rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
