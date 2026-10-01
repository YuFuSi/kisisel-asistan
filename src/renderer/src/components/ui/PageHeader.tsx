interface PageHeaderProps {
  title: string
  description?: string
  /** Sağ tarafta duran eylemler (düğme, arama kutusu vb.) */
  actions?: React.ReactNode
}

// Sayfaların ortak başlığı: başlık, kısa açıklama ve sağda eylemler
function PageHeader({ title, description, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-[32px] leading-tight font-semibold tracking-[-0.025em] text-transparent">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export default PageHeader
