import { useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  children: React.ReactNode
}

// Markdown içindeki kod bloğu: renklendirme highlight.js'ten gelir, üstüne kopyala düğmesi eklenir
function CodeBlock({ children }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  async function copy(): Promise<void> {
    const text = preRef.current?.innerText ?? ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Pano kullanılamıyorsa sessizce geç
    }
  }

  return (
    <div className="group/code relative my-3">
      <pre
        ref={preRef}
        className="overflow-x-auto rounded-lg border border-line bg-app p-3 text-[13px] leading-relaxed"
      >
        {children}
      </pre>
      <button
        onClick={() => void copy()}
        aria-label="Kodu kopyala"
        title="Kodu kopyala"
        className="absolute top-2 right-2 rounded-md border border-line bg-surface/90 p-1.5 text-faint opacity-0 transition group-hover/code:opacity-100 hover:text-ink focus:opacity-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-positive" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

export default CodeBlock
