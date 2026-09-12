import { Check, ShieldAlert, X } from 'lucide-react'
import type { ToolApproval } from '@shared/api'

interface ApprovalCardProps {
  approval: ToolApproval
  onRespond: (approved: boolean) => void
}

// Asistan riskli bir işlem yapmadan önce (uygulama/dosya açma) bu kart çıkar
function ApprovalCard({ approval, onRespond }: ApprovalCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-amber-200">{approval.label}</div>
          <div className="mt-1 text-sm text-zinc-100 select-text">{approval.summary}</div>
          {approval.details && (
            <div className="mt-0.5 truncate text-xs text-zinc-500" title={approval.details}>
              {approval.details}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onRespond(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <Check className="h-4 w-4" />
          Onayla
        </button>
        <button
          onClick={() => onRespond(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
          İptal
        </button>
      </div>
    </div>
  )
}

export default ApprovalCard
