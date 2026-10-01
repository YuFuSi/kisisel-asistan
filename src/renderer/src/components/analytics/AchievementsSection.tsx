import { Lock, Trophy } from 'lucide-react'
import type { Achievement } from '@shared/api'
import Card from '../ui/Card'
import InlineError from '../ui/InlineError'
import Skeleton from '../ui/Skeleton'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData); her yeni işlemde (activity) yenilenir
const loadAchievements = (): Promise<Achievement[]> => window.api.analytics.achievements()

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

// Başarımlar: Analizler sayfasının bir bölümü (eskiden ayrı sayfaydı). Tamamı activity_log'dan
// hesaplanır, dışarı hiçbir şey gönderilmez.
function AchievementsSection(): React.JSX.Element {
  const { data: achievements, error } = useLiveData(loadAchievements, 'activity')

  const achievedCount = achievements?.filter((a) => a.achieved).length ?? 0

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">Başarımlar</h2>
        {achievements && (
          <span className="text-xs text-muted">
            {achievedCount} / {achievements.length} rozet
          </span>
        )}
      </div>
      <InlineError message={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {achievements
          ? achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))
          : !error &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
      </div>
    </section>
  )
}

export default AchievementsSection
