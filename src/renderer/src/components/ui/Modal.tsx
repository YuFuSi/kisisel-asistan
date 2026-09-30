import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissLayer } from '../../lib/useDismissLayer'
import { useDialogFocus } from '../../lib/useDialogFocus'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title: string
}

// Genel modal kabuğu: karartılmış arka plan + ortalanmış düz panel. Escape veya dışına
// tıklayınca kapanır. document.body'ye portal ile taşınır, sayfadaki konumu önemli değil.
function Modal({ open, onClose, children, title }: ModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDismissLayer(open, 50, onClose)
  useDialogFocus(open, panelRef)

  if (!open) return null

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-app/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="card animate-enter max-h-[calc(100vh-32px)] w-full max-w-sm overflow-y-auto p-5 shadow-float"
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Modal
