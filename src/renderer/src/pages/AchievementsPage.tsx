import { useEffect, useState } from 'react'
import { Lock, Trophy } from 'lucide-react'
import type { Achievement } from '@shared/api'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

function AchievementCard({ achievement }: { achievement: Achievement }): React.JSX.Element {
  return (
    <Card
      className={`flex items-start gap-3 ${achievement.achieved ? 'border-accent/40' : 'opacity-60'}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          achievement.achieved ? 'bg-accent/15 text-accent' : 'bg-elevated text-faint'
        }`}
      >
        {achievement.achieved ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{achievement.title}</div>
        <p className="mt-0.5 text-xs text-muted">{achievement.description}</p>
      </div>
    </Card>
  )
}

// Başarımlar: tamamı activity_log'dan hesaplanır, dışarı hiçbir şey gönderilmez
function AchievementsPage(): React.JSX.Element {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null)

  useEffect(() => {
    let active = true
    window.api.analytics.achievements().then((value) => {
      if (active) setAchievements(value)
    })
    return () => {
      active = false
    }
  }, [])

  const achievedCount = achievements?.filter((a) => a.achieved).length ?? 0

  return (
    <div className="mx-auto max-w-3xl p-8">
      <PageHeader
        title="Başarımlar"
        description={
          achievements
            ? `${achievedCount} / ${achievements.length} rozet kazanıldı.`
            : 'Düzenli kullanım için küçük kutlamalar.'
        }
      />

      {!achievements ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AchievementsPage
