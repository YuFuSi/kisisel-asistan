import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

// Genel modal kabuğu: karartılmış arka plan + ortalanmış cam panel. Escape veya dışına
// tıklayınca kapanır. document.body'ye portal ile taşınır, sayfadaki konumu önemli değil.
function Modal({ open, onClose, children }: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-app/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-card animate-enter w-full max-w-sm p-5">{children}</div>
    </div>,
    document.body
  )
}

export default Modal
