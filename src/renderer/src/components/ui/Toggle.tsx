interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  /** Etiket görünmesin (satır içi anahtar); ekran okuyucu için aria-label olarak kalır */
  hideLabel?: boolean
  onChange: (checked: boolean) => void
}

// Açık/kapalı anahtarı
function Toggle({
  label,
  description,
  checked,
  disabled = false,
  hideLabel = false,
  onChange
}: ToggleProps): React.JSX.Element {
  return (
    <div className={hideLabel ? 'flex' : 'flex items-start justify-between gap-6'}>
      {!hideLabel && (
        <div>
          <div className={`text-sm font-medium ${disabled ? 'text-faint' : 'text-ink'}`}>
            {label}
          </div>
          {description && <div className="mt-0.5 text-xs text-faint">{description}</div>}
        </div>
      )}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-8 w-11 shrink-0 items-center rounded-control disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span
          className={`flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line-strong'}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </span>
      </button>
    </div>
  )
}

export default Toggle
