// Sonuç türü ve kararları ana süreçle ortak (shared/outcome.ts); arayüzdeki eski içe aktarmalar
// bozulmasın diye buradan da verilir
export type { OutcomeKind } from '@shared/api'
export { finishedOutcome, shouldCelebrate } from '../../../shared/outcome'
