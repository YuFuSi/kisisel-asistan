import type { ApprovalResult, OutcomeKind } from './api'

/**
 * Normal biten ("done") cevabın sonucu: onay sonuçları ve araç hatalarına göre.
 * Süresi dolan onay reddedilenden, reddedilen de araç hatasından önce gelir.
 */
export function finishedOutcome(toolFailed: boolean[], approvals: ApprovalResult[]): OutcomeKind {
  if (approvals.includes('timeout')) return 'timeout'
  if (approvals.includes('denied')) return 'rejected'
  return toolFailed.some(Boolean) ? 'partial' : 'completed'
}

/** Küre kutlasın mı: sadece gerçekten araçla yapılmış ve tamamen başarılı iş */
export function shouldCelebrate(kind: OutcomeKind, toolCount: number): boolean {
  return kind === 'completed' && toolCount > 0
}
