import type { ChatMessage, ToolActivity } from '@shared/api'
import type { OutcomeKind } from './outcome'

export const OUTCOME_LABELS: Record<OutcomeKind, string> = {
  completed: 'Tamamlandı',
  partial: 'Kısmen tamamlandı',
  stopped: 'Durduruldu',
  rejected: 'Onay verilmedi',
  error: 'İşlem tamamlanamadı'
}

export function activitySummary(
  tools: ToolActivity[],
  pending: boolean,
  approval: boolean,
  outcome?: OutcomeKind
): string {
  if (approval) return 'Onayını bekliyorum'
  if (pending)
    return tools.findLast((tool) => tool.status === 'running')?.label ?? 'Yanıt hazırlanıyor'
  return outcome ? OUTCOME_LABELS[outcome] : 'İşlem kaydı'
}

export function splitActivitySteps(tools: ToolActivity[]): {
  recent: ToolActivity[]
  previous: ToolActivity[]
} {
  return { recent: tools.slice(-3), previous: tools.slice(0, -3) }
}

export function formatActivityInput(input: unknown): string {
  if (input === undefined) return 'Girdi kaydedilmemiş.'
  try {
    return JSON.stringify(input, null, 2) ?? String(input)
  } catch {
    return 'Girdi görüntülenemedi.'
  }
}

// Araçlar zaten sohbet veritabanındadır. Bu küçük indeks yalnızca F0'ın sonuç türünü saklar;
// metin, dosya yolu ve araç girdisi tarayıcı deposuna ikinci kez kopyalanmaz.
export type ActivityOutcomes = Record<string, OutcomeKind>
const STORAGE_KEY = 'jarvis.activity-outcomes.v1'
const MAX_OUTCOMES = 1000

export function activityRecordKey(message: ChatMessage): string {
  return `${message.conversationId}:${message.id}:${message.createdAt}`
}

export function readActivityOutcomes(): ActivityOutcomes {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, kind]) => typeof kind === 'string' && Object.hasOwn(OUTCOME_LABELS, kind))
        .slice(-MAX_OUTCOMES)
    )
  } catch {
    return {}
  }
}

export function saveActivityOutcomes(outcomes: ActivityOutcomes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outcomes))
  } catch {
    // Depo dolu/kapalı olsa da sohbetin araç kaydı ve mevcut oturumun sonuçları okunabilir.
  }
}

export function rememberActivityOutcome(
  outcomes: ActivityOutcomes,
  message: ChatMessage,
  kind: OutcomeKind
): ActivityOutcomes {
  const key = activityRecordKey(message)
  if (outcomes[key] === kind) return outcomes
  return Object.fromEntries(Object.entries({ ...outcomes, [key]: kind }).slice(-MAX_OUTCOMES))
}

export function forgetConversationOutcomes(
  outcomes: ActivityOutcomes,
  conversationId: number
): ActivityOutcomes {
  return Object.fromEntries(
    Object.entries(outcomes).filter(([key]) => !key.startsWith(`${conversationId}:`))
  )
}
