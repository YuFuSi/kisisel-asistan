import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatRole } from '@shared/api'

interface MessageBubbleProps {
  role: ChatRole
  content: string
  pending?: boolean
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

function MessageBubble({ role, content, pending = false }: MessageBubbleProps): React.JSX.Element {
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
      <div className="prose prose-sm max-w-[90%] prose-invert select-text prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900">
        {content ? (
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
        ) : (
          pending && <TypingDots />
        )}
      </div>
    </div>
  )
}

export default MessageBubble
