interface LogoProps {
  className?: string
}

// Jarvis logosu: ışıyan mavi halka
function Logo({ className = 'h-6 w-6' }: LogoProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="jarvis-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-glow)" />
          <stop offset="1" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        stroke="var(--color-glow)"
        strokeOpacity="0.25"
        strokeWidth="7"
      />
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        stroke="url(#jarvis-logo-gradient)"
        strokeWidth="3"
      />
    </svg>
  )
}

export default Logo
