import { Lock, Trophy } from 'lucide-react'
import type { Achievement } from '@shared/api'
import { motion } from 'motion/react'
import IconTile from '../ui/IconTile'
import { useReducedMotion } from '../../lib/useReducedMotion'
import InlineError from '../ui/InlineError'
import Skeleton from '../ui/Skeleton'
import { useLiveData } from '../../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData); her yeni işlemde (activity) yenilenir
const loadAchievements = (): Promise<Achievement[]> => window.api.analytics.achievements()

function AchievementCard({ achievement }: { achievement: Achievement }): React.JSX.Element {
  const reduced = useReducedMotion()
  return (
    <motion.div
      layout={!reduced}
      initial={false}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 }}
      className={`glass-soft flex min-w-0 items-start gap-3 p-4 ${achievement.achieved ? 'ring-1 ring-positive/20' : ''}`}
    >
      <IconTile
        icon={achievement.achieved ? Trophy : Lock}
        tone={achievement.achieved ? 'green' : 'lilac'}
        size={36}
      />
      <div className="min-w-0 break-words">
        <div className="text-sm font-medium text-ink">{achievement.title}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{achievement.description}</p>
      </div>
    </motion.div>
  )
}

// Başarımlar: Analizler sayfasının bir bölümü (eskiden ayrı sayfaydı). Tamamı activity_log'dan
// hesaplanır, dışarı hiçbir şey gönderilmez.
function AchievementsSection(): React.JSX.Element {
  const { data: achievements, error } = useLiveData(loadAchievements, 'activity')

  const achievedCount = achievements?.filter((a) => a.achieved).length ?? 0

  return (
    <section className="glass space-y-4 p-5" aria-labelledby="achievements-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={Trophy} tone="green" />
          <h2 id="achievements-heading" className="text-sm font-medium text-ink">
            Başarımlar
          </h2>
        </div>
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
