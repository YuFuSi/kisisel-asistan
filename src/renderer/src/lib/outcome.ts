/**
 * Bir cevabın nasıl bittiği. "Cevap bitti" ile "iş başarıyla yapıldı" aynı şey değil:
 * - completed: araçların hepsi çalıştı (veya araç yoktu)
 * - partial: cevap bitti ama en az bir araç hata verdi
 * - rejected: kullanıcı bir onayı reddetti (veya süre doldu)
 * - stopped: kullanıcı durdurdu
 * - error: cevap hatayla kesildi
 */
export type OutcomeKind = 'completed' | 'partial' | 'rejected' | 'stopped' | 'error'

/** Normal biten ("done") cevabın sonucu: araç hataları ve reddedilen onaylara göre */
export function finishedOutcome(toolFailed: boolean[], rejected: boolean): OutcomeKind {
  if (rejected) return 'rejected'
  return toolFailed.some(Boolean) ? 'partial' : 'completed'
}

/** Küre kutlasın mı: sadece gerçekten araçla yapılmış ve tamamen başarılı iş */
export function shouldCelebrate(kind: OutcomeKind, toolCount: number): boolean {
  return kind === 'completed' && toolCount > 0
}
