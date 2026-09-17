import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { AutomationRun } from '@shared/api'
import { formatReminderTime } from '../../lib/dates'

interface AutomationRunHistoryProps {
  automationId: number
}

function StatusIcon({ status }: { status: AutomationRun['status'] }): React.JSX.Element {
  const className = 'h-4 w-4 shrink-0'
  if (status === 'done') return <CheckCircle2 className={`${className} text-positive`} />
  if (status === 'error') return <XCircle className={`${className} text-negative`} />
  return <Loader2 className={`${className} animate-spin text-muted`} />
}

// Bir rutinin geçmiş çalıştırmaları; genişletilince yüklenir
function AutomationRunHistory({ automationId }: AutomationRunHistoryProps): React.JSX.Element {
  const [runs, setRuns] = useState<AutomationRun[] | null>(null)

  useEffect(() => {
    let alive = true
    window.api.automations.listRuns(automationId).then(
      (data) => {
        if (alive) setRuns(data)
      },
      () => {
        if (alive) setRuns([])
      }
    )
    return () => {
      alive = false
    }
  }, [automationId])

  if (!runs) return <p className="px-3 py-2 text-xs text-faint">Yükleniyor...</p>
  if (runs.length === 0) return <p className="px-3 py-2 text-xs text-faint">Henüz çalışmadı.</p>

  return (
    <ul className="space-y-1.5 border-t border-line px-3 py-2">
      {runs.map((run) => (
        <li key={run.id} className="flex items-start gap-2 text-xs">
          <StatusIcon status={run.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-muted">{run.summary || '...'}</p>
            {run.skippedTools.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-caution">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {run.skippedTools.length} adım izin yetersizliğinden atlandı
              </p>
            )}
          </div>
          <span className="shrink-0 text-faint">{formatReminderTime(run.startedAt)}</span>
        </li>
      ))}
    </ul>
  )
}

export default AutomationRunHistory
