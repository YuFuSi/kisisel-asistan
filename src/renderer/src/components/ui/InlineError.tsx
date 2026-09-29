import { AlertCircle } from 'lucide-react'

// Ortak satır içi hata: sayfa verisi yüklenemediğinde vb. (anlık bildirimler için useToast)
function InlineError({
  message
}: {
  message: string | null | undefined
}): React.JSX.Element | null {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative select-text"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

export default InlineError
