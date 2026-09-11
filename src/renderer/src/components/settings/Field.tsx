interface FieldProps {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-zinc-300">{label}</div>
      {children}
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

export default Field
