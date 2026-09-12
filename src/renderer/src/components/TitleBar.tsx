import { Sparkles } from 'lucide-react'

interface TitleBarProps {
  /** O an açık olan sayfanın adı */
  page: string
}

// Windows'un gri başlık çubuğu yerine uygulamanın kendi çubuğu.
// Kapat/küçült düğmeleri Windows tarafından sağ tarafa çizilir, o alan boş bırakılır.
function TitleBar({ page }: TitleBarProps): React.JSX.Element {
  return (
    <header
      className="drag-region flex h-[var(--titlebar-height)] shrink-0 items-center gap-2.5 border-b border-line bg-app px-3"
      style={{ paddingRight: 150 }}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-sm font-medium text-ink">Kişisel Asistan</span>
      <span className="text-faint">·</span>
      <span className="min-w-0 truncate text-sm text-muted">{page}</span>
    </header>
  )
}

export default TitleBar
