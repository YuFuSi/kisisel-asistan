import type { ConversationSearchResult } from '@shared/api'

/** SQLite'ın yerel saat dilimsiz UTC dizgesini ("2026-09-22 10:00:00") gerçek zamana çevirir */
export function parseSqliteUtc(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

export interface ConversationGroup {
  label: string
  items: ConversationSearchResult[]
}

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const DAY_MS = 86_400_000

/**
 * Sohbet listesini sabitlenenler ve son güncellemeye göre "Bugün / Dün / Bu hafta / Daha eski"
 * gruplarına ayırır. Boş gruplar döndürülmez. Arama sırasında (relevans sıralaması bozulmasın
 * diye) çağıran taraf bunu kullanmaz, düz listeyi gösterir.
 */
export function groupConversations(
  results: ConversationSearchResult[],
  now: Date
): ConversationGroup[] {
  const pinned = results.filter((r) => r.conversation.pinned)
  const rest = results.filter((r) => !r.conversation.pinned)

  const today: ConversationSearchResult[] = []
  const yesterday: ConversationSearchResult[] = []
  const thisWeek: ConversationSearchResult[] = []
  const older: ConversationSearchResult[] = []

  for (const result of rest) {
    const diff = Math.round(
      (startOfDay(now) - startOfDay(parseSqliteUtc(result.conversation.updatedAt))) / DAY_MS
    )
    if (diff <= 0) today.push(result)
    else if (diff === 1) yesterday.push(result)
    else if (diff <= 6) thisWeek.push(result)
    else older.push(result)
  }

  const groups: ConversationGroup[] = [
    { label: 'Sabitli', items: pinned },
    { label: 'Bugün', items: today },
    { label: 'Dün', items: yesterday },
    { label: 'Bu hafta', items: thisWeek },
    { label: 'Daha eski', items: older }
  ]
  return groups.filter((group) => group.items.length > 0)
}
