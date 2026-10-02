interface FieldProps {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-2">
      <div className="text-sm font-medium text-ink">{label}</div>
      {children}
      {hint && <div className="text-xs leading-relaxed text-faint">{hint}</div>}
    </div>
  )
}

export default Field
