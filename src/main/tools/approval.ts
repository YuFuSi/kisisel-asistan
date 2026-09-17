import { randomUUID } from 'node:crypto'
import { getToolContext } from './context'
import { needsApproval } from './permissions'
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
 * Bir otomasyonun izin seviyesi bir aracın onay gereksinimini karşılamadığında fırlatılır.
 * Gerçek bir hata değil: pencere açılıp beklenmez, çalıştırma geçmişine "atlandı" diye kaydedilir.
 */
export class AutomationApprovalSkipped extends Error {
  constructor(public readonly toolLabel: string) {
    super(`"${toolLabel}" izin yetersizliği nedeniyle atlandı.`)
    this.name = 'AutomationApprovalSkipped'
  }
}

type ApprovalListener = (conversationId: number, approval: ToolApproval) => void
// Onay istendiğinde haber alanlar (ör. sesli sohbet onayı sesle sorar)
const approvalListeners = new Set<ApprovalListener>()

export function onApprovalRequested(listener: ApprovalListener): () => void {
  approvalListeners.add(listener)
  return () => {
    approvalListeners.delete(listener)
  }
}

export function isApprovalPending(approvalId: string): boolean {
  return pending.has(approvalId)
}

/**
 * Riskli araçlar bunu çağırır: arayüze onay kartı gönderir ve cevabı bekler.
 * Kullanıcı reddederse veya süre dolarsa hata fırlatır; böylece araç işini yapmadan durur.
 * İzin kuralları onay gerektirmiyorsa (ör. kullanıcının tam izin verdiği rutin) kart gösterilmez.
 */
export async function requireApproval(request: Omit<ToolApproval, 'id'>): Promise<void> {
  const context = getToolContext()
  if (!context) throw new Error('Onay istenemedi: sohbet bağlamı bulunamadı.')

  const call = context.call
  const required = needsApproval({
    // Sarmalayıcı dışından çağrılırsa en sıkı kural uygulanır
    risk: call?.risk ?? 'dangerous',
    source: context.source,
    allowance: context.allowance,
    external: context.external
  })
  if (!required) {
    if (call) call.approval = 'auto'
    return
  }

  // Otomasyonlar hiçbir zaman pencere açılıp beklemez: izin yetmiyorsa adım atlanır ve kaydedilir
  if (context.source === 'automation') {
    if (call) call.approval = 'skipped'
    throw new AutomationApprovalSkipped(request.label)
  }

  const sender = context.sender
  if (!sender) throw new Error('Onay istenemedi: pencere bağlamı bulunamadı.')

  const approval: ToolApproval = { ...request, id: randomUUID() }
  const send = (event: ChatEvent): void => {
    if (!sender.isDestroyed()) sender.send('chat:event', event)
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
    approvalListeners.forEach((listener) => listener(context.conversationId, approval))
  })

  if (call) call.approval = outcome
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
