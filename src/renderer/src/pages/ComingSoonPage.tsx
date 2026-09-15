import type { LucideIcon } from 'lucide-react'
import { cardClass } from '../lib/styles'

interface ComingSoonPageProps {
  icon: LucideIcon
  title: string
  description: string
  /** Bu sayfa hazır olunca neler sunacağı, kısa maddeler halinde */
  bullets: string[]
}

// Yol haritasında planlanan ama henüz yapılmamış sayfalar için ortak "yakında" ekranı
function ComingSoonPage({
  icon: Icon,
  title,
  description,
  bullets
}: ComingSoonPageProps): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      <div className={`${cardClass} flex flex-col items-center gap-4 px-6 py-14 text-center`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <div className="text-sm font-medium text-ink">Yakında</div>
          <p className="mt-1 text-sm text-muted">Bu bölüm henüz geliştirilmedi.</p>
        </div>
        <ul className="mt-2 space-y-1.5 text-left text-sm text-muted">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ComingSoonPage
