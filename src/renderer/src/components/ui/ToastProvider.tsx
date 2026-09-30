import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ToastContext, type ToastApi, type ToastItem, type ToastKind } from '../../lib/toast'

const VISIBLE_MS = 4000

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

const TONE: Record<ToastKind, string> = {
  success: 'border-positive/30 text-positive',
  error: 'border-negative/30 text-negative',
  info: 'border-line text-ink'
}

// Ekranın sağ altında kısa süre görünen bildirimler
function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number): void => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => {
    const show = (message: string, kind: ToastKind = 'info'): void => {
      const id = Date.now() + Math.random()
      setItems((list) => [...list.slice(-2), { id, kind, message }])
      setTimeout(() => dismiss(id), VISIBLE_MS)
    }
    return {
      show,
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error')
    }
  }, [dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
        {items.map((item) => {
          const Icon = ICONS[item.kind]
          return (
            <div
              key={item.id}
              role="status"
              className={`animate-enter pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-elevated px-3 py-2.5 text-sm shadow-lg ${TONE[item.kind]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 text-ink select-text">{item.message}</span>
              <button
                onClick={() => dismiss(item.id)}
                aria-label="Kapat"
                className="inline-flex min-h-8 min-w-8 items-center justify-center rounded p-0.5 text-faint transition-colors hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
