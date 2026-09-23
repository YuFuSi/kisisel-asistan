import type { Automation, AutomationRun } from '@shared/api'

export type WorkerStatus = 'running' | 'soon' | 'idle'

export interface Worker {
  id: number
  name: string
  status: WorkerStatus
  /** status 'soon' iken dakika, 'running'/'idle' iken null */
  minutesUntil: number | null
}

const SOON_MS = 5 * 60_000

/**
 * Sidebar'daki "arka plan işçileri": açık rutinlerden şu an çalışanlar ve yakında (5 dk içinde)
 * çalışacaklar. Kapalı rutinler ve uzak gelecektekiler gösterilmez, liste kalabalıklaşmasın.
 */
export function buildWorkers(
  automations: Automation[],
  lastRuns: Map<number, AutomationRun | undefined>,
  now: number
): Worker[] {
  const workers: Worker[] = []
  for (const automation of automations) {
    if (!automation.enabled) continue
    const lastRun = lastRuns.get(automation.id)
    if (lastRun && lastRun.status === 'running') {
      workers.push({
        id: automation.id,
        name: automation.name,
        status: 'running',
        minutesUntil: null
      })
      continue
    }
    const delta = automation.nextRunAt - now
    if (delta >= 0 && delta <= SOON_MS) {
      workers.push({
        id: automation.id,
        name: automation.name,
        status: 'soon',
        minutesUntil: Math.max(1, Math.round(delta / 60_000))
      })
    }
  }
  return workers
}
