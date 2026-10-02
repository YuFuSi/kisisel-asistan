import { MessageSquare } from 'lucide-react'
import ApprovalCard from '../chat/ApprovalCard'
import {
  respondToApproval,
  usePendingApprovals,
  useVisibleConversation
} from '../../lib/assistantState'

interface ApprovalDockProps {
  onOpenConversation: (conversationId: number) => void
}

// Pıtır bir işlem için onay beklerken, kullanıcı başka sayfada veya başka sohbetteyse kart
// burada, içeriğin sağ altında durur. Böylece Pıtır "çalışıyor gibi görünüp" sessizce beklemez.
// Ekrandaki sohbetin onayı zaten sohbetin içinde gösterildiği için burada tekrar çıkmaz.
function ApprovalDock({ onOpenConversation }: ApprovalDockProps): React.JSX.Element | null {
  const approvals = usePendingApprovals()
  const visible = useVisibleConversation()
  const waiting = approvals.filter((item) => item.conversationId !== visible)
  const first = waiting[0]
  if (!first) return null

  return (
    <div
      role="region"
      aria-label="Onay bekleyen işlem"
      className="animate-fade absolute right-6 bottom-6 z-50 w-96 max-w-[calc(100%-3rem)] space-y-2 rounded-card border border-line bg-elevated p-3 shadow-float"
    >
      <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted">
        <span>
          Pıtır onayını bekliyor
          {waiting.length > 1 && ` · ${waiting.length} işlem`}
        </span>
        <button
          onClick={() => onOpenConversation(first.conversationId)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-accent hover:text-accent-hover"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Sohbete git
        </button>
      </div>
      <ApprovalCard
        approval={first.approval}
        onRespond={(approved) => respondToApproval(first.approval.id, approved)}
      />
    </div>
  )
}

export default ApprovalDock
