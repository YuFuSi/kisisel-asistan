import { describe, expect, it } from 'vitest'
import type { WebContents } from 'electron'
import { requireApproval } from './approval'
import { runWithToolContext, type ToolCallState, type ToolContext } from './context'
import { needsApproval } from './permissions'
import type { ChatEvent } from '../../shared/api'

describe('needsApproval', () => {
  it('okuma araçları hiçbir zaman onay istemez', () => {
    for (const source of ['chat', 'automation', 'voice', 'remote'] as const) {
      expect(needsApproval({ risk: 'read', source, external: true })).toBe(false)
    }
  })

  it('değişiklik yapan araçlar sohbette serbest, rutinde izne bağlı', () => {
    expect(needsApproval({ risk: 'write', source: 'chat' })).toBe(false)
    expect(needsApproval({ risk: 'write', source: 'voice' })).toBe(false)
    expect(needsApproval({ risk: 'write', source: 'automation' })).toBe(true)
    expect(needsApproval({ risk: 'write', source: 'automation', allowance: 'write' })).toBe(false)
    expect(needsApproval({ risk: 'write', source: 'remote' })).toBe(true)
  })

  it('tehlikeli araçlar sadece tam izinli rutinde onaysız çalışır', () => {
    expect(needsApproval({ risk: 'dangerous', source: 'chat' })).toBe(true)
    expect(needsApproval({ risk: 'dangerous', source: 'voice' })).toBe(true)
    expect(needsApproval({ risk: 'dangerous', source: 'automation', allowance: 'write' })).toBe(
      true
    )
    expect(needsApproval({ risk: 'dangerous', source: 'automation', allowance: 'all' })).toBe(false)
    expect(needsApproval({ risk: 'dangerous', source: 'remote', allowance: 'all' })).toBe(true)
  })

  it('dışarıdan gelen içerik tam izni kullanamaz', () => {
    expect(
      needsApproval({ risk: 'dangerous', source: 'automation', allowance: 'all', external: true })
    ).toBe(true)
  })
})

describe('requireApproval ve izinler', () => {
  function context(events: ChatEvent[], extra: Partial<ToolContext>): ToolContext {
    const sender = {
      isDestroyed: () => false,
      send: (_channel: string, event: ChatEvent) => events.push(event)
    } as unknown as WebContents
    return { conversationId: 1, sender, source: 'chat', ...extra }
  }

  it('tam izinli rutinde kart göstermeden devam eder', async () => {
    const events: ChatEvent[] = []
    const call: ToolCallState = { name: 'uygulama_ac', risk: 'dangerous' }
    await runWithToolContext(
      context(events, { source: 'automation', allowance: 'all', call }),
      () =>
        requireApproval({ toolName: 'uygulama_ac', label: 'Uygulama açılsın mı?', summary: 'X' })
    )
    expect(events).toHaveLength(0)
    expect(call.approval).toBe('auto')
  })

  it('dışarıdan gelen içerikte tam izinli rutin de onay gerektirir; otomasyon pencere açmadan atlar', async () => {
    const events: ChatEvent[] = []
    const call: ToolCallState = { name: 'eposta_gonder', risk: 'dangerous' }
    await expect(
      runWithToolContext(
        context(events, { source: 'automation', allowance: 'all', external: true, call }),
        () => requireApproval({ toolName: 'eposta_gonder', label: 'Gönderilsin mi?', summary: 'X' })
      )
    ).rejects.toThrow('atlandı')
    expect(events).toHaveLength(0)
    expect(call.approval).toBe('skipped')
  })
})
