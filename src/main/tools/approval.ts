import { randomUUID } from 'node:crypto'
import { getToolContext } from './context'
import type { ChatEvent, ToolApproval } from '../../shared/api'

// Kullanıcı bu süre içinde cevap vermezse işlem yapılmaz
const APPROVAL_TIMEOUT_MS = 120_000

type Outcome = 'approved' | 'denied' | 'timeout'

interface PendingApproval {
  conversationId: number
  settle: (outcome: Outcome) => void
}

const pending = new Map<string, PendingApproval>()

/**
 * Riskli araçlar bunu çağırır: arayüze onay kartı gönderir ve cevabı bekler.
 * Kullanıcı reddederse veya süre dolarsa hata fırlatır; böylece araç işini yapmadan durur.
 */
export async function requireApproval(request: Omit<ToolApproval, 'id'>): Promise<void> {
  const context = getToolContext()
  if (!context) throw new Error('Onay istenemedi: sohbet bağlamı bulunamadı.')

  const approval: ToolApproval = { ...request, id: randomUUID() }
  const send = (event: ChatEvent): void => {
    if (!context.sender.isDestroyed()) context.sender.send('chat:event', event)
  }

  const outcome = await new Promise<Outcome>((resolve) => {
    const timer = setTimeout(() => finish('timeout'), APPROVAL_TIMEOUT_MS)
    const finish = (result: Outcome): void => {
      clearTimeout(timer)
      pending.delete(approval.id)
      resolve(result)
    }
    pending.set(approval.id, { conversationId: context.conversationId, settle: finish })
    send({ conversationId: context.conversationId, type: 'approval', approval })
  })

  send({
    conversationId: context.conversationId,
    type: 'approval-resolved',
    approvalId: approval.id,
    approved: outcome === 'approved'
  })

  if (outcome === 'timeout') throw new Error('Onay beklenirken süre doldu, işlem yapılmadı.')
  if (outcome === 'denied') throw new Error('Kullanıcı bu işlemi onaylamadı.')
}

export function respondToApproval(approvalId: string, approved: boolean): void {
  pending.get(approvalId)?.settle(approved ? 'approved' : 'denied')
}

/** Sohbet durdurulduğunda veya silindiğinde bekleyen onaylar iptal edilir */
export function cancelApprovals(conversationId: number): void {
  for (const [id, entry] of [...pending]) {
    if (entry.conversationId === conversationId) pending.get(id)?.settle('denied')
  }
}

/** Sadece testler için: bekleyen onay sayısı */
export function pendingApprovalCount(): number {
  return pending.size
}
