import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '../../lib/useReducedMotion'

export interface SpeechBubbleProps {
  text: string
  tone?: 'normal' | 'approval' | 'success' | 'error'
  actions?: ReactNode
  side?: 'left' | 'right'
  /** Metin tamamen göründüğünde bir kez çağrılır; gizlenme bildirimi değildir. */
  onDone?: () => void
  /** Tam metin göründükten sonra bekleme süresi. Onay düğmeleri varsa gizlenmez. */
  autoHideMs?: number
}

const borders = {
  normal: 'var(--color-line)',
  approval: 'var(--color-caution)',
  success: 'var(--color-positive)',
  error: 'var(--color-negative)'
}

function BubbleContent({
  text,
  tone = 'normal',
  actions,
  side = 'left',
  onDone,
  autoHideMs
}: SpeechBubbleProps): React.JSX.Element {
  const reduced = useReducedMotion()
  const letters = Array.from(text)
  const [count, setCount] = useState(0)
  const [visible, setVisible] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const callback = useRef(onDone)
  const complete = reduced || count >= letters.length

  useEffect(() => {
    callback.current = onDone
  }, [onDone])

  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => setCount(letters.length), 0)
      return () => clearTimeout(timer)
    }
    if (count >= letters.length) return
    const timer = setTimeout(() => setCount((value) => value + 1), 35)
    return () => clearTimeout(timer)
  }, [count, letters.length, reduced])

  useEffect(() => {
    if (complete && !done.current) {
      done.current = true
      callback.current?.()
    }
  }, [complete])

  useEffect(() => {
    if (tone !== 'approval') return
    root.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [tone, actions])

  useEffect(() => {
    if (!complete || autoHideMs === undefined || !Number.isFinite(autoHideMs)) return
    if (tone === 'approval' && actions) return
    const timer = setTimeout(() => setVisible(false), Math.max(0, autoHideMs))
    return () => clearTimeout(timer)
  }, [complete, autoHideMs, tone, actions])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={root}
          className="glass relative min-w-0 max-w-sm px-5 py-4 text-sm leading-relaxed text-ink"
          style={{
            borderColor: borders[tone],
            transformOrigin: side === 'left' ? 'bottom left' : 'bottom right'
          }}
          initial={reduced ? false : { opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 4 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 24 }}
        >
          {/* Canlı bölge her harfte tekrar okunmaz; tam mesaj tek seferde sunulur. */}
          <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {text}
          </span>
          <p
            aria-hidden="true"
            className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            {complete ? text : letters.slice(0, count).join('')}
          </p>
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
          <span
            aria-hidden="true"
            className={`absolute -bottom-2 h-4 w-4 rotate-45 border-b border-r bg-elevated ${side === 'left' ? 'left-6' : 'right-6'}`}
            style={{ borderColor: borders[tone] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SpeechBubble(props: SpeechBubbleProps): React.JSX.Element {
  // Yeni mesaj önceki daktilo/gizleme zamanlayıcılarını ve tamamlanma durumunu sıfırlar.
  return <BubbleContent key={props.text} {...props} />
}

export default SpeechBubble

/* Örnek (ses bağımsızdır; çağıran bileşenin effect temizliğinde stop çağrılır):
 * const enabled = useSfxEnabled()
 * useEffect(() => {
 *   const speech = speakBabble(text, { volume: 0.5, enabled })
 *   return speech.stop
 * }, [text, enabled])
 * <SpeechBubble text={text} tone="approval" actions={<button>Onayla</button>} />
 */
