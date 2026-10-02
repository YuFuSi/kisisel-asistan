import { motion, MotionConfig } from 'motion/react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Flame,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import type { UsageStats } from '@shared/api'
import AchievementsSection from '../components/analytics/AchievementsSection'
import IconTile, { type IconTone } from '../components/ui/IconTile'
import { useReducedMotion } from '../lib/useReducedMotion'
import InlineError from '../components/ui/InlineError'
import PageLayout from '../components/ui/PageLayout'
import Skeleton from '../components/ui/Skeleton'
import { useLiveData } from '../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData); her yeni işlemde (activity) yenilenir
const loadUsage = (): Promise<UsageStats> => window.api.analytics.usage()

// Yerel tarihi "22 Eyl" gibi kısa gösterir
function shortDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short'
  })
}

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: string
  tone?: IconTone
}

function StatTile({ icon, label, value, tone = 'teal' }: StatTileProps): React.JSX.Element {
  return (
    <div className="glass-soft flex min-w-0 items-center gap-3 p-4">
      <IconTile icon={icon} tone={tone} size={36} />
      <div className="min-w-0">
        <div className="break-words text-xl font-semibold tracking-tight text-ink">{value}</div>
        <div className="text-xs leading-snug text-muted">{label}</div>
      </div>
    </div>
  )
}

// Son 14 günün kullanımı, en yüksek güne göre ölçeklenmiş basit çubuklar
function UsageChart({ days }: { days: UsageStats['last14Days'] }): React.JSX.Element {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="flex h-32 gap-1.5">
      {days.map((day) => (
        <div
          key={day.date}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div
            title={`${shortDay(day.date)}: ${day.count} çağrı`}
            className={`w-full rounded-t-md ${day.count > 0 ? 'bg-accent/60' : 'bg-transparent'}`}
            style={{ height: `${(day.count / max) * 100}%` }}
          />
          <span className="text-[10px] text-faint">{shortDay(day.date).split(' ')[0]}</span>
        </div>
      ))}
    </div>
  )
}

function ToolBar({
  name,
  count,
  max
}: {
  name: string
  count: number
  max: number
}): React.JSX.Element {
  const reduced = useReducedMotion()
  return (
    <motion.div
      layout={!reduced}
      initial={false}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 }}
    >
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-muted">{name}</span>
        <span className="shrink-0 text-faint">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(count / max) * 100}%` }}
        />
      </div>
    </motion.div>
  )
}

// Kullanım istatistikleri: tamamı activity_log'dan hesaplanır, dışarı hiçbir şey gönderilmez
function AnalyticsPage(): React.JSX.Element {
  const { data: stats, error } = useLiveData(loadUsage, 'activity')
  const reduced = useReducedMotion()

  return (
    <MotionConfig
      reducedMotion={reduced ? 'always' : 'never'}
      transition={reduced ? { duration: 0 } : undefined}
    >
      <PageLayout
        reduceMotion={reduced}
        title="Analizler"
        description="Pıtır'ı nasıl kullandığın; tamamı bu bilgisayardaki verilerden hesaplanır."
      >
        <InlineError message={error} />
        {!stats ? (
          error ? null : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          )
        ) : stats.totalCalls === 0 ? (
          <div className="glass flex flex-col items-center gap-2 px-5 py-14 text-center">
            <IconTile icon={Wrench} tone="teal" size={44} />
            <div className="text-sm font-medium text-ink">Henüz veri yok</div>
            <p className="max-w-sm text-sm text-muted">
              Pıtır bir araç kullandığında (görev ekleme, hatırlatma kurma vb.) burada birikmeye
              başlar.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={Wrench} label="Toplam çağrı" value={String(stats.totalCalls)} />
              <StatTile
                icon={CheckCircle2}
                label="Başarılı"
                value={String(stats.doneCalls)}
                tone="green"
              />
              <StatTile
                icon={AlertTriangle}
                label="Teknik hata"
                value={String(stats.errorCalls)}
                tone="amber"
              />
              <StatTile
                tone="lilac"
                icon={Flame}
                label="Kullanım serisi"
                value={`${stats.activeDayStreak} gün`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                icon={AlertTriangle}
                tone="amber"
                label="Kullanıcı reddi"
                value={String(stats.deniedCalls)}
              />
              <StatTile
                icon={AlertTriangle}
                tone="amber"
                label="Onay süresi doldu"
                value={String(stats.timeoutCalls)}
              />
              <StatTile
                icon={AlertTriangle}
                tone="amber"
                label="İzin nedeniyle atlanan"
                value={String(stats.skippedCalls)}
              />
            </div>
            <section className="glass space-y-4 p-5" aria-labelledby="usage-chart-heading">
              <div className="flex items-center gap-2.5">
                <IconTile icon={BarChart3} tone="blue" />
                <h2 id="usage-chart-heading" className="text-sm font-medium text-ink">
                  Son 14 gün
                </h2>
              </div>
              <UsageChart days={stats.last14Days} />
            </section>

            {stats.topTools.length > 0 && (
              <section className="glass space-y-4 p-5" aria-labelledby="top-tools-heading">
                <div className="flex items-center gap-2.5">
                  <IconTile icon={Wrench} tone="teal" />
                  <h2 id="top-tools-heading" className="text-sm font-medium text-ink">
                    En çok kullanılan araçlar
                  </h2>
                </div>
                {stats.topTools.map((tool) => (
                  <ToolBar
                    key={tool.name}
                    name={tool.label}
                    count={tool.count}
                    max={stats.topTools[0].count}
                  />
                ))}
              </section>
            )}
          </div>
        )}

        <div className="mt-8">
          <AchievementsSection />
        </div>
      </PageLayout>
    </MotionConfig>
  )
}

export default AnalyticsPage
