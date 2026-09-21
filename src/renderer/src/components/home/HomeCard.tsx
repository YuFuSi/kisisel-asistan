import type { LucideIcon } from 'lucide-react'
import Card from '../ui/Card'

interface HomeCardProps {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}

// Ana Sayfa'nın alt sıradaki düz kartı
function HomeCard({ title, icon: Icon, children }: HomeCardProps): React.JSX.Element {
  return (
    <Card padding="md" className="h-full">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
        <Icon className="h-4 w-4 text-faint" />
        {title}
      </h2>
      {children}
    </Card>
  )
}

export default HomeCard
