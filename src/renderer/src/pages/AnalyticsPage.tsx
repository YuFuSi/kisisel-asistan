import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Flame, Wrench } from 'lucide-react'
import type { UsageStats } from '@shared/api'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

// Yerel tarihi "22 Eyl" gibi kısa gösterir
function shortDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short'
  })
}

interface StatTileProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: 'accent' | 'positive' | 'negative'
}

const TONE_CLASS = {
  accent: 'bg-accent/10 text-accent',
  positive: 'bg-positive/10 text-positive',
  negative: 'bg-negative/10 text-negative'
}

function StatTile({ icon: Icon, label, value, tone = 'accent' }: StatTileProps): React.JSX.Element {
  return (
    <Card className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_CLASS[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-semibold tracking-tight text-ink">{value}</div>
        <div className="text-xs leading-snug text-muted">{label}</div>
      </div>
    </Card>
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
          className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div
            title={`${shortDay(day.date)}: ${day.count} çağrı`}
            className={`w-full rounded-t-md transition-all ${day.count > 0 ? 'bg-accent/60' : 'bg-line'}`}
            style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
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
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate text-muted">{name}</span>
        <span className="shrink-0 text-faint">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(count / max) * 100}%` }}
        />
      </div>
    </div>
  )
}

// Kullanım istatistikleri: tamamı activity_log'dan hesaplanır, dışarı hiçbir şey gönderilmez
function AnalyticsPage(): React.JSX.Element {
  const [stats, setStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    let active = true
    window.api.analytics.usage().then((value) => {
      if (active) setStats(value)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl p-8">
      <PageHeader
        title="Analizler"
        description="Jarvis'i nasıl kullandığın; tamamı bu bilgisayardaki verilerden hesaplanır."
      />

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : stats.totalCalls === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <Wrench className="h-8 w-8 text-faint" />
          <div className="text-sm font-medium text-ink">Henüz veri yok</div>
          <p className="max-w-sm text-sm text-muted">
            Jarvis bir araç kullandığında (görev ekleme, hatırlatma kurma vb.) burada birikmeye
            başlar.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Wrench} label="Toplam çağrı" value={String(stats.totalCalls)} />
            <StatTile
              icon={CheckCircle2}
              label="Başarılı"
              value={String(stats.doneCalls)}
              tone="positive"
            />
            <StatTile
              icon={AlertTriangle}
              label="Hatalı / engellenen"
              value={String(stats.errorCalls + stats.blockedCalls)}
              tone="negative"
            />
            <StatTile icon={Flame} label="Kullanım serisi" value={`${stats.activeDayStreak} gün`} />
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-medium text-ink">Son 14 gün</h2>
            <UsageChart days={stats.last14Days} />
          </Card>

          {stats.topTools.length > 0 && (
            <Card className="space-y-3">
              <h2 className="text-sm font-medium text-ink">En çok kullanılan araçlar</h2>
              {stats.topTools.map((tool) => (
                <ToolBar
                  key={tool.name}
                  name={tool.label}
                  count={tool.count}
                  max={stats.topTools[0].count}
                />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
