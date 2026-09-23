interface FloatingTileProps {
  label: string
  value: string
  /** Değerin altındaki küçük ayrıntı */
  detail?: string
  onClick?: () => void
  /** Yerleşim sınıfları (ör. `left-0 top-[14%]`) ve giriş gecikmesi */
  className?: string
  delayMs?: number
}

// Kürenin çevresinde süzülen küçük yarı saydam bilgi parçası
function FloatingTile({
  label,
  value,
  detail,
  onClick,
  className = '',
  delayMs = 0
}: FloatingTileProps): React.JSX.Element {
  const body = (
    <>
      <div className="text-[11px] font-medium tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 truncate text-lg font-medium text-ink tabular-nums">{value}</div>
      {detail && <div className="truncate text-xs text-muted">{detail}</div>}
    </>
  )
  const base =
    'animate-tile absolute hidden w-44 rounded-2xl border border-line/80 bg-surface/85 px-4 py-3 text-left @min-[780px]:block'

  return onClick ? (
    <button
      onClick={onClick}
      className={`${base} transition-colors hover:border-line-strong hover:bg-surface ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {body}
    </button>
  ) : (
    <div className={`${base} ${className}`} style={{ animationDelay: `${delayMs}ms` }}>
      {body}
    </div>
  )
}

export default FloatingTile
