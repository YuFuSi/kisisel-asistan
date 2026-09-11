import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Loader2, X } from 'lucide-react'
import type { ChatRole, ToolActivity, ToolStatus } from '@shared/api'

interface MessageBubbleProps {
  role: ChatRole
  content: string
  tools?: ToolActivity[]
  pending?: boolean
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
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
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
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
            tool.status === 'error'
              ? 'border-red-900/60 bg-red-950/30 text-red-300'
              : 'border-zinc-800 bg-zinc-900 text-zinc-400'
          }`}
        >
          {tool.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
          {tool.status === 'done' && <Check className="h-3 w-3 text-emerald-400" />}
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
  pending = false
}: MessageBubbleProps): React.JSX.Element {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white select-text">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] min-w-0">
        {tools.length > 0 && <ToolChips tools={tools} />}
        {content ? (
          <div className="prose prose-sm max-w-none prose-invert select-text prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          pending && <TypingDots />
        )}
      </div>
    </div>
  )
}

export default MessageBubble
