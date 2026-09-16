import type { ReactNode } from 'react'
import { LEVEL_DOT_CLASS, type Level } from '../../lib/statusLevel'

interface StatusDotProps {
  level: Level
  /** Sürekli yanıp sönme (ör. bir şey devam ederken) */
  pulse?: boolean
  className?: string
}

// Durum rengini gösteren küçük nokta. Varsayılan boyut h-2 w-2, className ile ezilebilir.
export function StatusDot({
  level,
  pulse = false,
  className = ''
}: StatusDotProps): React.JSX.Element {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT_CLASS[level]} ${pulse ? 'animate-pulse' : ''} ${className}`}
    />
  )
}

interface BadgeProps {
  level: Level
  children: ReactNode
}

// Nokta + metinden oluşan hap biçimli etiket
function Badge({ level, children }: BadgeProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted">
      <StatusDot level={level} className="h-1.5 w-1.5" pulse={level === 'active'} />
      {children}
    </span>
  )
}

export default Badge
