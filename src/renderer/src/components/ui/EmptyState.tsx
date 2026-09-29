import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** İsteğe bağlı eylem (ör. "Görev ekle" düğmesi) */
  action?: React.ReactNode
  /** Dar alanlarda (liste içi) daha az boşluk */
  compact?: boolean
}

// Ortak boş durum: özür değil, davet. Başlık alanı adlandırır, açıklama ne işe yaradığını söyler.
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'gap-1.5 py-8' : 'gap-2 py-14'}`}
    >
      <Icon className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} text-faint`} aria-hidden="true" />
      <div className="text-sm font-medium text-ink">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export default EmptyState
