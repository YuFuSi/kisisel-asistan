interface ComingSoonProps {
  title: string
  description: string
  stage: number
}

// Henüz yapılmamış sayfalar için geçici içerik
function ComingSoon({ title, description, stage }: ComingSoonProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      <div className="mt-8 flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
        Bu bölüm Aşama {stage}&apos;de eklenecek.
      </div>
    </div>
  )
}

export default ComingSoon
