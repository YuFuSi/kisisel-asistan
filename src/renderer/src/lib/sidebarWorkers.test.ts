import { describe, expect, it } from 'vitest'
import type { Automation, AutomationRun } from '@shared/api'
import { buildWorkers } from './sidebarWorkers'

function automation(over: Partial<Automation> = {}): Automation {
  return {
    id: 1,
    name: 'Rutin',
    prompt: 'yap',
    timeOfDay: '09:00',
    repeat: 'daily',
    allowance: 'write',
    enabled: true,
    nextRunAt: 0,
    ...over
  }
}

function run(over: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 1,
    automationId: 1,
    startedAt: 0,
    finishedAt: null,
    status: 'running',
    summary: '',
    skippedTools: [],
    ...over
  }
}

const now = 1_000_000

describe('buildWorkers', () => {
  it('kapalı rutini asla göstermez', () => {
    const workers = buildWorkers([automation({ enabled: false, nextRunAt: now })], new Map(), now)
    expect(workers).toEqual([])
  })

  it('son çalıştırması hâlâ süren rutini "running" gösterir', () => {
    const lastRuns = new Map([[1, run({ status: 'running' })]])
    const workers = buildWorkers([automation()], lastRuns, now)
    expect(workers).toEqual([{ id: 1, name: 'Rutin', status: 'running', minutesUntil: null }])
  })

  it('5 dk içinde çalışacak rutini "soon" gösterir', () => {
    const workers = buildWorkers([automation({ nextRunAt: now + 3 * 60_000 })], new Map(), now)
    expect(workers[0]).toEqual({ id: 1, name: 'Rutin', status: 'soon', minutesUntil: 3 })
  })

  it("5 dk'dan uzaktaki rutini göstermez", () => {
    const workers = buildWorkers([automation({ nextRunAt: now + 30 * 60_000 })], new Map(), now)
    expect(workers).toEqual([])
  })

  it('geçmişte kalan nextRunAt (henüz zamanlayıcı güncellemedi) gösterilmez', () => {
    const workers = buildWorkers([automation({ nextRunAt: now - 1000 })], new Map(), now)
    expect(workers).toEqual([])
  })
})
