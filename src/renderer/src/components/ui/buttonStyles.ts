export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-app hover:bg-accent-hover',
  secondary:
    'border border-line bg-transparent text-ink hover:border-line-strong hover:bg-elevated',
  ghost: 'text-muted hover:bg-elevated hover:text-ink',
  danger: 'bg-negative/90 text-app hover:bg-negative'
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-8 gap-1.5 rounded-lg px-3 py-1.5 text-xs',
  md: 'gap-2 rounded-[10px] px-4 py-2 text-sm'
}

export const ICON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4'
}

/**
 * Düğme sınıflarının tek kaynağı: <Button> bileşeni ve düz <button className={...}> kullanan
 * yerler (lib/styles.ts) aynı görünümü buradan alır.
 */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `inline-flex shrink-0 items-center justify-center font-medium transition-[color,background-color,border-color,transform] duration-[var(--motion-control)] ease-calm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]}`
}
