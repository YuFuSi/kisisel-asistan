import { useCallback } from 'react'
import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { ActivityEntry, ActivityStatus, ToolSource } from '@shared/api'
import Skeleton from '../ui/Skeleton'
import { formatReminderTime } from '../../lib/dates'
import { cardClass } from '../../lib/styles'
import { useLiveData } from '../../lib/useLiveData'

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
  timeout: 'Onay süresi doldu',
  skipped: 'İzin yetersiz, atlandı'
}

function StatusIcon({ status }: { status: ActivityStatus }): React.JSX.Element {
  const className = 'h-4 w-4'
  switch (status) {
    case 'done':
      return <CheckCircle2 className={`${className} text-positive`} />
    case 'error':
      return <XCircle className={`${className} text-negative`} />
    case 'denied':
    case 'skipped':
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

/** Bugünse sadece saat, değilse "Dün 14:20" gibi */
function shortTime(ms: number): string {
  const date = new Date(ms)
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
  return formatReminderTime(ms)
}

interface ActivityListProps {
  /** En fazla kaç kayıt gösterilsin */
  limit?: number
  /** Ana Sayfa kartı için sade görünüm */
  compact?: boolean
}

// Asistanın son kullandığı araçlar (etkinlik kaydı); yeni işlem olunca kendiliğinden yenilenir
function ActivityList({ limit = 10, compact = false }: ActivityListProps): React.JSX.Element {
  const load = useCallback(() => window.api.activity.list(limit), [limit])
  const { data, error } = useLiveData(load, 'activity')

  if (error) return <p className="text-sm text-negative select-text">{error}</p>
  if (!data) return <Skeleton className="h-24 w-full" />
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        Henüz bir işlem yok. Asistan bir araç kullandığında burada görünür.
      </p>
    )
  }

  if (compact) {
    return (
      <ul className="space-y-1">
        {data.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-lg px-1 py-1.5"
            title={entry.detail}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated">
              <StatusIcon status={entry.status} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm text-ink">{entry.label}</div>
              <div className="truncate text-xs text-faint">{entry.summary || describe(entry)}</div>
            </div>
            <span className="shrink-0 text-[11px] text-faint">{shortTime(entry.createdAt)}</span>
          </li>
        ))}
      </ul>
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
