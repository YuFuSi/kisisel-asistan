import { useRef, useState } from 'react'
import { SendHorizontal, Square } from 'lucide-react'
import { COMPOSER_INPUT_ID } from '../../lib/dom'

interface ComposerProps {
  busy: boolean
  disabled: boolean
  onSend: (text: string) => void
  onStop: () => void
}

const MAX_HEIGHT = 200

function Composer({ busy, disabled, onSend, onStop }: ComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Yazı uzadıkça kutu büyüsün (en fazla MAX_HEIGHT)
  function resize(): void {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  function submit(): void {
    const value = text.trim()
    if (!value || busy || disabled) return
    onSend(value)
    setText('')
    requestAnimationFrame(resize)
  }

  return (
    <div className="border-t border-zinc-800 p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors focus-within:border-zinc-600">
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
              : 'Bir mesaj yaz... (Shift+Enter: yeni satır)'
          }
          style={{ maxHeight: MAX_HEIGHT }}
          className="flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
        {busy ? (
          <button
            onClick={onStop}
            aria-label="Durdur"
            title="Durdur"
            className="rounded-lg bg-zinc-700 p-1.5 text-white transition-colors hover:bg-zinc-600"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !text.trim()}
            aria-label="Gönder"
            title="Gönder"
            className="rounded-lg bg-violet-600 p-1.5 text-white transition-colors hover:bg-violet-500 disabled:bg-transparent disabled:text-zinc-600"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default Composer
