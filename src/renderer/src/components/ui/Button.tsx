import { Loader2, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-sm hover:bg-accent-hover',
  secondary: 'border border-line bg-elevated text-ink hover:border-line-strong hover:bg-line/40',
  ghost: 'text-muted hover:bg-line/40 hover:text-ink',
  danger: 'bg-negative/90 text-white hover:bg-negative'
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'gap-1.5 rounded-md px-3 py-1.5 text-xs',
  md: 'gap-2 rounded-lg px-4 py-2 text-sm'
}

const ICON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4'
}

// Ortak düğme: variant/size ile tutarlı görünüm, ikon ve yükleniyor durumu destekler
function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const iconClass = ICON_SIZE_CLASS[size]
  const content = loading ? (
    <Loader2 className={`${iconClass} animate-spin`} />
  ) : (
    Icon && <Icon className={iconClass} />
  )

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium transition-colors transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {iconPosition === 'left' && content}
      {children}
      {iconPosition === 'right' && content}
    </button>
  )
}

export default Button
