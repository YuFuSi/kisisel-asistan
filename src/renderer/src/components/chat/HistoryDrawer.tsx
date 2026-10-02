import IconTile from '../ui/IconTile'
import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { History, X } from 'lucide-react'
import { useDismissLayer } from '../../lib/useDismissLayer'
import { useDialogFocus } from '../../lib/useDialogFocus'

export default function HistoryDrawer({
  open,
  onClose,
  children
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}): React.JSX.Element | null {
  const panel = useRef<HTMLDivElement>(null)
  useDismissLayer(open, 40, onClose)
  useDialogFocus(open, panel)
  if (!open) return null
  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-40 flex bg-app/70"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Sohbet geçmişi"
        tabIndex={-1}
        className="glass flex h-full w-72 max-w-[calc(100vw-32px)] flex-col shadow-float"
        style={{ backgroundColor: 'var(--color-app)' }}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <IconTile icon={History} tone="blue" />
            <h2 className="text-sm font-medium text-ink">Sohbet geçmişi</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Geçmişi kapat"
            className="min-h-8 min-w-8 rounded-control text-muted hover:bg-surface"
          >
            <X className="mx-auto h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
