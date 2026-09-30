import type { ActivityEntry } from '../../shared/api'
import { toLocalDate } from './datetime'

export interface ToolUsage {
  name: string
  label: string
  count: number
}

export interface DayUsage {
  /** Yerel tarih: 2026-09-22 */
  date: string
  count: number
}

export interface UsageStats {
  totalCalls: number
  doneCalls: number
  errorCalls: number
  /** Onay reddedilen veya izin yetersizliğinden atlanan çağrılar */
  blockedCalls: number
  deniedCalls: number
  timeoutCalls: number
  skippedCalls: number
  /** En çok kullanılan 5 araç, çoktan aza */
  topTools: ToolUsage[]
  /** Son 14 günün günlük çağrı sayısı, en eskiden en yeniye */
  last14Days: DayUsage[]
  /** Bugün dahil, art arda en az bir çağrı yapılan gün sayısı */
  activeDayStreak: number
  /** Sesle başlatılan çağrı sayısı */
  voiceCalls: number
  /** Bir rutin (otomasyon) yüzünden kendiliğinden çalışan çağrı sayısı */
  automationCalls: number
  distinctTools: number
}

const DAY_MS = 86_400_000
const HISTORY_DAYS = 14

/** activity_log kayıtlarından kullanım istatistikleri; girdi elektron'a bağlı değil, testlerde sahte kayıtlarla çağrılabilir */
export function computeUsageStats(entries: ActivityEntry[], now: Date): UsageStats {
  const toolCounts = new Map<string, ToolUsage>()
  const dayCounts = new Map<string, number>()
  let doneCalls = 0
  let errorCalls = 0
  let blockedCalls = 0
  let deniedCalls = 0
  let timeoutCalls = 0
  let skippedCalls = 0
  let voiceCalls = 0
  let automationCalls = 0

  for (const entry of entries) {
    const tool = toolCounts.get(entry.name)
    toolCounts.set(entry.name, {
      name: entry.name,
      label: entry.label,
      count: (tool?.count ?? 0) + 1
    })

    const day = toLocalDate(new Date(entry.createdAt))
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)

    if (entry.status === 'done') doneCalls++
    else if (entry.status === 'error') errorCalls++
    else if (
      entry.status === 'denied' ||
      entry.status === 'timeout' ||
      entry.status === 'skipped'
    ) {
      blockedCalls++
      if (entry.status === 'denied') deniedCalls++
      else if (entry.status === 'timeout') timeoutCalls++
      else skippedCalls++
    }
    if (entry.source === 'voice') voiceCalls++
    if (entry.source === 'automation') automationCalls++
  }

  const topTools = [...toolCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5)

  const last14Days: DayUsage[] = []
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = toLocalDate(new Date(now.getTime() - i * DAY_MS))
    last14Days.push({ date, count: dayCounts.get(date) ?? 0 })
  }

  let activeDayStreak = 0
  for (let i = 0; i < 365; i++) {
    const date = toLocalDate(new Date(now.getTime() - i * DAY_MS))
    if ((dayCounts.get(date) ?? 0) === 0) break
    activeDayStreak++
  }

  return {
    totalCalls: entries.length,
    doneCalls,
    errorCalls,
    blockedCalls,
    deniedCalls,
    timeoutCalls,
    skippedCalls,
    topTools,
    last14Days,
    activeDayStreak,
    voiceCalls,
    automationCalls,
    distinctTools: toolCounts.size
  }
}
