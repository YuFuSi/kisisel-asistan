import type { LucideIcon } from 'lucide-react'

interface HomeCardProps {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}

// Ana Sayfa'nın sağ sütunundaki cam kart
function HomeCard({ title, icon: Icon, children }: HomeCardProps): React.JSX.Element {
  return (
    <section className="glass-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
        <Icon className="h-4 w-4 text-glow" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default HomeCard
