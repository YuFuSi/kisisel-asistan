import { useState } from 'react'
import { ChevronDown, History, Play, Repeat, Trash2 } from 'lucide-react'
import { ALLOWANCE_LABELS, REPEAT_LABELS, type Automation } from '@shared/api'
import AutomationRunHistory from './AutomationRunHistory'
import Button from '../ui/Button'
import Toggle from '../ui/Toggle'
import Tooltip from '../ui/Tooltip'
import { formatReminderTime } from '../../lib/dates'
import { iconButtonClass } from '../../lib/styles'

interface AutomationItemProps {
  automation: Automation
  onToggleEnabled: (enabled: boolean) => void
  onRunNow: () => Promise<boolean>
  onDelete: () => void
}

function AutomationItem({
  automation,
  onToggleEnabled,
  onRunNow,
  onDelete
}: AutomationItemProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)

  async function runNow(): Promise<void> {
    setRunning(true)
    await onRunNow()
    setRunning(false)
    setExpanded(true)
  }

  return (
    <li className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle
          label={automation.enabled ? 'Rutini kapat' : 'Rutini aç'}
          checked={automation.enabled}
          onChange={onToggleEnabled}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{automation.name}</span>
            {automation.repeat !== 'none' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                <Repeat className="h-3 w-3" />
                {REPEAT_LABELS[automation.repeat]}
              </span>
            )}
            <Tooltip content={automation.prompt} side="bottom">
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-faint">
                {ALLOWANCE_LABELS[automation.allowance]}
              </span>
            </Tooltip>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">{automation.prompt}</p>
        </div>
        <span className="shrink-0 text-xs text-faint">
          {automation.enabled ? formatReminderTime(automation.nextRunAt) : 'Kapalı'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={Play}
          loading={running}
          onClick={() => void runNow()}
          aria-label="Şimdi çalıştır"
          title="Şimdi çalıştır"
        />
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label="Çalıştırma geçmişi"
          title="Çalıştırma geçmişi"
          className={iconButtonClass}
        >
          <History className={`h-4 w-4 ${expanded ? 'text-ink' : ''}`} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Rutini sil"
          title="Sil"
          className={`${iconButtonClass} hover:text-negative`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && <AutomationRunHistory automationId={automation.id} />}
    </li>
  )
}

export default AutomationItem
