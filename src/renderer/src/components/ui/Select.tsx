import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

// inputClass ile aynı görünümde, native <select> üzerine kurulu (erişilebilirlik/klavye için
// özel bir açılır liste yazılmadı — sadece OS'in varsayılan okunu tema rengiyle değiştiriyor)
function Select({ className = '', ...rest }: SelectProps): React.JSX.Element {
  return (
    <div className="relative">
      <select
        className={`w-full appearance-none rounded-lg border border-line bg-surface px-3 py-2 pr-9 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-accent/70 disabled:opacity-50 ${className}`}
        {...rest}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-faint" />
    </div>
  )
}

export default Select
