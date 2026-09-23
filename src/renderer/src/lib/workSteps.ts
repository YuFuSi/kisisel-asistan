import type { ToolActivity } from '@shared/api'

/** Asistanın o anki cevabında çalışan ya da biten bir araç adımı */
export interface WorkStep {
  id: string
  name: string
  label: string
  status: ToolActivity['status']
}

/** Küre çevresinde en fazla bu kadar adım gösterilir; fazlası en eskiden düşer */
export const MAX_STEPS = 12

/** Aynı araç etkinliği yeniden gelirse (ör. çalışıyor -> bitti) yerinde günceller, yenisini sona ekler */
export function upsertStep(steps: WorkStep[], activity: ToolActivity): WorkStep[] {
  const next: WorkStep = {
    id: activity.id,
    name: activity.name,
    label: activity.label,
    status: activity.status
  }
  const index = steps.findIndex((step) => step.id === activity.id)
  if (index >= 0) {
    const copy = steps.slice()
    copy[index] = next
    return copy
  }
  return [...steps, next].slice(-MAX_STEPS)
}

/** Şu an çalışan son adım; hiçbiri çalışmıyorsa null */
export function currentStep(steps: WorkStep[]): WorkStep | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status === 'running') return steps[i]
  }
  return null
}
