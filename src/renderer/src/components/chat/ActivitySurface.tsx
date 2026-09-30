import { useId, useState } from 'react'
import { Check, ChevronDown, Circle, Loader2, Square, X } from 'lucide-react'
import type { ToolActivity, ToolApproval } from '@shared/api'
import type { OutcomeKind } from '../../lib/outcome'
import { activitySummary, formatActivityInput, splitActivitySteps } from '../../lib/activitySurface'
import { buttonClass } from '../../lib/styles'
import ApprovalCard from './ApprovalCard'
import ResultCard from '../jarvis/ResultCard'
import { errorMessage } from '../../lib/errors'

interface ActivitySurfaceProps {
  tools: ToolActivity[]
  pending?: boolean
  outcome?: OutcomeKind
  approval?: ToolApproval | null
  onRespond?: (approved: boolean) => void
  onStop?: () => Promise<void>
}

type DetailLevel = 'summary' | 'steps' | 'technical'
const STEP_LABELS: Record<ToolActivity['status'], string> = {
  running: 'Çalışıyor',
  done: 'Tamamlandı',
  error: 'Tamamlanamadı'
}

function ActivityStep({
  tool,
  technical
}: {
  tool: ToolActivity
  technical: boolean
}): React.JSX.Element {
  return (
    <li className="min-w-0 py-2">
      <div className="flex items-start gap-2 text-sm">
        {tool.status === 'running' ? (
          <Loader2
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent"
            aria-hidden="true"
          />
        ) : tool.status === 'done' ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <X className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 break-words text-ink">{tool.label}</span>
        <span className="shrink-0 text-xs text-faint">{STEP_LABELS[tool.status]}</span>
      </div>
      {tool.status === 'done' && tool.card && (
        <div className="mt-2 ml-6">
          <ResultCard card={tool.card} />
        </div>
      )}
      {technical && (
        <div className="mt-2 ml-6 space-y-2 text-xs select-text">
          <p className="break-all font-mono text-muted">Araç: {tool.name}</p>
          <div>
            <p className="mb-1 text-faint">Girdi</p>
            <pre className="max-h-48 overflow-auto rounded-control bg-app p-2 font-mono whitespace-pre-wrap break-all text-muted">
              {formatActivityInput(tool.input)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-faint">{tool.status === 'error' ? 'Hata' : 'Sonuç'}</p>
            <pre className="max-h-48 overflow-auto rounded-control bg-app p-2 font-mono whitespace-pre-wrap break-all text-muted">
              {tool.result ??
                (tool.status === 'running'
                  ? 'Sonuç bekleniyor.'
                  : 'Sonuç ayrıntısı kaydedilmemiş.')}
            </pre>
          </div>
        </div>
      )}
    </li>
  )
}

function ActivitySurface({
  tools,
  pending = false,
  outcome,
  approval,
  onRespond,
  onStop
}: ActivitySurfaceProps): React.JSX.Element {
  const [level, setLevel] = useState<DetailLevel>(pending ? 'steps' : 'summary')
  const [stopRequested, setStopRequested] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)
  const [previousOpen, setPreviousOpen] = useState(false)
  const contentId = useId()
  const { recent, previous } = splitActivitySteps(tools)
  const expanded = level !== 'summary'
  const technical = level === 'technical'
  const summary = activitySummary(tools, pending, !!approval, outcome)
  async function stop(): Promise<void> {
    if (!onStop || stopRequested) return
    setStopRequested(true)
    setStopError(null)
    try {
      await onStop()
    } catch (err) {
      setStopRequested(false)
      setStopError(errorMessage(err))
    }
  }

  return (
    <section
      aria-label="Jarvis etkinliği"
      className={`mb-3 rounded-control border bg-surface ${approval ? 'border-caution/40' : 'border-line'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setLevel(expanded ? 'summary' : 'steps')}
          className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-control text-left"
        >
          {pending && !approval ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
          ) : (
            <Circle
              className={`h-3 w-3 shrink-0 ${approval ? 'text-caution' : 'text-accent'}`}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-faint">
              Jarvis etkinliği{tools.length > 0 && ` · ${tools.length} adım`}
            </span>
            <span role="status" className="block text-sm font-medium break-words text-ink">
              {summary}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-[var(--motion-control)] ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {pending && onStop && (
          <button
            onClick={() => void stop()}
            disabled={stopRequested}
            className={buttonClass('ghost', 'sm')}
            aria-label="Jarvis işlemini durdur"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{stopRequested ? 'Durduruluyor' : 'Durdur'}</span>
          </button>
        )}
      </div>
      <div id={contentId} hidden={!expanded} className="border-t border-line px-3 pb-3">
        {previous.length > 0 && (
          <details className="pt-2" onToggle={(event) => setPreviousOpen(event.currentTarget.open)}>
            <summary className="min-h-8 cursor-pointer rounded-control py-1.5 text-xs text-muted">
              Önceki {previous.length} adım
            </summary>
            <ol className="divide-y divide-line">
              {previousOpen &&
                previous.map((tool) => (
                  <ActivityStep key={tool.id} tool={tool} technical={technical} />
                ))}
            </ol>
          </details>
        )}
        <ol className="divide-y divide-line">
          {recent.map((tool) => (
            <ActivityStep key={tool.id} tool={tool} technical={technical} />
          ))}
        </ol>
        {tools.length === 0 && (
          <p className="py-3 text-sm text-muted">
            {approval
              ? 'İlerlemeden önce onayın gerekiyor.'
              : pending
                ? 'İsteğin değerlendiriliyor.'
                : 'Bu işlemde araç adımı kaydedilmedi.'}
          </p>
        )}
        <button
          onClick={() => setLevel(technical ? 'steps' : 'technical')}
          aria-pressed={technical}
          className={buttonClass('ghost', 'sm')}
        >
          {technical ? 'Ayrıntıları gizle' : 'Teknik ayrıntılar'}
        </button>
        {technical && (
          <p className="mt-2 text-xs text-faint">
            Araç sonuçları kaydedilirken kısaltılmış olabilir.
          </p>
        )}
      </div>
      {/* Onay, kullanıcı özeti kapatsa bile görünür kalır; ortak depo yanıtı her yerde kaldırır. */}
      {approval && onRespond && (
        <div className="border-t border-line p-3">
          <ApprovalCard approval={approval} onRespond={onRespond} />
        </div>
      )}
      {stopError && (
        <p role="alert" className="px-3 pb-3 text-sm text-negative">
          {stopError}
        </p>
      )}
    </section>
  )
}

export default ActivitySurface
