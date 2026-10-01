import { Check, ShieldAlert, X } from 'lucide-react'
import type { ToolApproval } from '@shared/api'

interface ApprovalCardProps {
  approval: ToolApproval
  onRespond: (approved: boolean) => void
}

// Asistan riskli bir işlem yapmadan önce (uygulama/dosya açma) bu kart çıkar
function ApprovalCard({ approval, onRespond }: ApprovalCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-caution/40 bg-caution/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-caution" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-caution">{approval.label}</div>
          <div className="mt-1 text-sm text-ink select-text">{approval.summary}</div>
          {approval.details && (
            <div className="mt-0.5 truncate text-xs text-faint" title={approval.details}>
              {approval.details}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onRespond(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-positive px-3 py-1.5 text-sm font-medium text-app transition-opacity hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          Onayla
        </button>
        <button
          onClick={() => onRespond(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink transition-colors hover:bg-elevated"
        >
          <X className="h-4 w-4" />
          Reddet
        </button>
      </div>
    </div>
  )
}

export default ApprovalCard
