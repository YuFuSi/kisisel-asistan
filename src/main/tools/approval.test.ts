import { describe, expect, it } from 'vitest'
import type { WebContents } from 'electron'
import {
  cancelApprovals,
  pendingApprovalCount,
  requireApproval,
  respondToApproval
} from './approval'
import { runWithToolContext } from './context'
import type { ChatEvent } from '../../shared/api'

// Arayüz yerine olayları toplayan sahte pencere
function fakeSender(events: ChatEvent[]): WebContents {
  return {
    isDestroyed: () => false,
    send: (_channel: string, event: ChatEvent) => events.push(event)
  } as unknown as WebContents
}

const request = { toolName: 'uygulama_ac', label: 'Uygulama açılsın mı?', summary: 'Not Defteri' }

async function startApproval(events: ChatEvent[]): Promise<{ promise: Promise<void>; id: string }> {
  const promise = runWithToolContext({ conversationId: 1, sender: fakeSender(events) }, () =>
    requireApproval(request)
  )
  await new Promise((resolve) => setTimeout(resolve, 5))
  const first = events[0]
  if (first.type !== 'approval') throw new Error('Onay olayı gönderilmedi')
  return { promise, id: first.approval.id }
}

describe('requireApproval', () => {
  it('onaylanınca işleme devam eder', async () => {
    const events: ChatEvent[] = []
    const { promise, id } = await startApproval(events)
    respondToApproval(id, true)
    await expect(promise).resolves.toBeUndefined()
    expect(events.at(-1)).toMatchObject({ type: 'approval-resolved', approved: true })
    expect(pendingApprovalCount()).toBe(0)
  })

  it('reddedilince hata fırlatır', async () => {
    const events: ChatEvent[] = []
    const { promise, id } = await startApproval(events)
    respondToApproval(id, false)
    await expect(promise).rejects.toThrow('onaylamadı')
  })

  it('sohbet durdurulunca bekleyen onay iptal edilir', async () => {
    const events: ChatEvent[] = []
    const { promise } = await startApproval(events)
    cancelApprovals(1)
    await expect(promise).rejects.toThrow()
    expect(pendingApprovalCount()).toBe(0)
  })

  it('sohbet bağlamı yoksa onay istenemez', async () => {
    await expect(requireApproval(request)).rejects.toThrow('bağlam')
  })
})
