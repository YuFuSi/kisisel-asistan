import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { ActivityEntry, ActivityStatus, ToolSource } from '@shared/api'
import Skeleton from '../ui/Skeleton'
import { formatReminderTime } from '../../lib/dates'
import { cardClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

const loadActivity = (): Promise<ActivityEntry[]> => window.api.activity.list(10)

const SOURCE_LABELS: Record<ToolSource, string> = {
  chat: 'Sohbet',
  automation: 'Rutin',
  voice: 'Ses',
  remote: 'Uzaktan'
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  done: 'Tamamlandı',
  error: 'Hata',
  denied: 'Onaylanmadı',
  timeout: 'Onay süresi doldu'
}

function StatusIcon({ status }: { status: ActivityStatus }): React.JSX.Element {
  const className = 'h-4 w-4'
  switch (status) {
    case 'done':
      return <CheckCircle2 className={`${className} text-positive`} />
    case 'error':
      return <XCircle className={`${className} text-negative`} />
    case 'denied':
      return <Ban className={`${className} text-caution`} />
    case 'timeout':
      return <Clock className={`${className} text-caution`} />
  }
}

function describe(entry: ActivityEntry): string {
  const approval =
    entry.approval === 'approved' ? 'onaylandı' : entry.approval === 'auto' ? 'rutin izniyle' : null
  const status = entry.status === 'done' ? null : STATUS_LABELS[entry.status]
  return [entry.summary, SOURCE_LABELS[entry.source], approval, status].filter(Boolean).join(' · ')
}

// Asistanın son kullandığı araçlar (etkinlik kaydı); yeni işlem olunca kendiliğinden yenilenir
function ActivityList(): React.JSX.Element {
  const { data, error } = useLiveData(loadActivity, 'activity')

  if (error) return <p className="text-sm text-negative select-text">{error}</p>
  if (!data) return <Skeleton className="h-24 w-full" />
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        Henüz bir işlem yok. Asistan bir araç kullandığında burada görünür.
      </p>
    )
  }

  return (
    <ul className={`${cardClass} divide-y divide-line`}>
      {data.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 px-4 py-3" title={entry.detail}>
          <span className="mt-0.5 shrink-0" title={STATUS_LABELS[entry.status]}>
            <StatusIcon status={entry.status} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-ink">{entry.label}</span>
              <span className="shrink-0 text-xs text-faint">
                {formatReminderTime(entry.createdAt)}
              </span>
            </div>
            <div className="truncate text-xs text-muted">{describe(entry)}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ActivityList
