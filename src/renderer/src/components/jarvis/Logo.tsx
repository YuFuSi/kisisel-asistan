interface LogoProps {
  className?: string
}

// Pıtır logosu: tek renkli ince halka ve içinde küçük nokta
function Logo({ className = 'h-6 w-6' }: LogoProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="3.5" fill="var(--color-accent)" />
    </svg>
  )
}

export default Logo
