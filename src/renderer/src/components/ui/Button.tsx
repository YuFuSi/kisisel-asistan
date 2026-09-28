import { Loader2, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, ICON_SIZE_CLASS, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
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
      className={`${buttonClass(variant, size)} ${className}`}
      {...rest}
    >
      {iconPosition === 'left' && content}
      {children}
      {iconPosition === 'right' && content}
    </button>
  )
}

export default Button
