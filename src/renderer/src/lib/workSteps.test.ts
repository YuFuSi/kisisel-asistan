import { describe, expect, it } from 'vitest'
import type { ToolActivity } from '@shared/api'
import { currentStep, MAX_STEPS, upsertStep, type WorkStep } from './workSteps'

function activity(id: string, status: ToolActivity['status'] = 'running'): ToolActivity {
  return { id, name: `arac_${id}`, label: `Araç ${id}`, status }
}

describe('upsertStep', () => {
  it('yeni araç etkinliğini sona ekler', () => {
    const steps = upsertStep(upsertStep([], activity('a')), activity('b'))
    expect(steps.map((step) => step.id)).toEqual(['a', 'b'])
  })

  it('aynı etkinlik gelince yerinde günceller ve sırayı korur', () => {
    let steps = upsertStep([], activity('a'))
    steps = upsertStep(steps, activity('b'))
    steps = upsertStep(steps, activity('a', 'done'))
    expect(steps.map((step) => `${step.id}:${step.status}`)).toEqual(['a:done', 'b:running'])
  })

  it('eski listeyi değiştirmez (yeni dizi döner)', () => {
    const before: WorkStep[] = upsertStep([], activity('a'))
    const after = upsertStep(before, activity('a', 'done'))
    expect(before[0].status).toBe('running')
    expect(after).not.toBe(before)
  })

  it('en fazla MAX_STEPS adım tutar, en eskiyi düşürür', () => {
    let steps: WorkStep[] = []
    for (let i = 0; i < MAX_STEPS + 3; i++) steps = upsertStep(steps, activity(String(i), 'done'))
    expect(steps).toHaveLength(MAX_STEPS)
    expect(steps[0].id).toBe('3')
    expect(steps[steps.length - 1].id).toBe(String(MAX_STEPS + 2))
  })
})

describe('currentStep', () => {
  it('çalışan son adımı verir', () => {
    let steps = upsertStep([], activity('a', 'done'))
    steps = upsertStep(steps, activity('b'))
    steps = upsertStep(steps, activity('c'))
    expect(currentStep(steps)?.id).toBe('c')
  })

  it('çalışan yoksa null döner', () => {
    expect(currentStep(upsertStep([], activity('a', 'done')))).toBeNull()
    expect(currentStep([])).toBeNull()
  })
})
