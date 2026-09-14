import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { closeDb, initDatabase } from '../db'
import { listActivity } from '../data/activity'
import { listTasks } from '../data/tasks'
import { cancelApprovals } from './approval'
import { runWithToolContext, type ToolContext } from './context'
import { getAssistantTools } from './index'
import type { ChatEvent } from '../../shared/api'

// Testte açık pencere yok; "veri değişti" olayı sadece sayılır
vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))

beforeEach(() => initDatabase(':memory:'))
afterEach(() => closeDb())

function context(events: ChatEvent[], extra: Partial<ToolContext> = {}): ToolContext {
  const sender = {
    isDestroyed: () => false,
    send: (_channel: string, event: ChatEvent) => events.push(event)
  } as unknown as WebContents
  return { conversationId: 7, sender, source: 'chat', ...extra }
}

// AI SDK'nın araca verdiği ikinci parametre; bu araçlar kullanmıyor
const options = { toolCallId: 'test', messages: [] } as never

async function run(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
  const execute = getAssistantTools()[name]?.execute
  if (!execute) throw new Error(`${name} aracı yok`)
  return runWithToolContext(ctx, () => execute(input, options))
}

describe('araç sarmalayıcısı', () => {
  it('sohbette değişiklik yapan aracı onaysız çalıştırır ve kaydeder', async () => {
    const events: ChatEvent[] = []
    await run('gorev_ekle', { baslik: 'TEST süt al' }, context(events))

    expect(events).toHaveLength(0)
    expect(listTasks().map((task) => task.title)).toEqual(['TEST süt al'])
    expect(listActivity()).toEqual([
      expect.objectContaining({
        name: 'gorev_ekle',
        label: 'Görev ekleme',
        source: 'chat',
        status: 'done',
        approval: null,
        conversationId: 7,
        summary: expect.stringContaining('TEST süt al')
      })
    ])
  })

  it('rutinde izin yoksa onay ister; reddedilirse iş yapılmaz ve kayda "denied" yazılır', async () => {
    const events: ChatEvent[] = []
    const promise = run(
      'gorev_ekle',
      { baslik: 'Rutin görevi' },
      context(events, { source: 'automation' })
    )
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(events[0]).toMatchObject({ type: 'approval', approval: { toolName: 'gorev_ekle' } })

    cancelApprovals(7)
    await expect(promise).rejects.toThrow('onaylamadı')
    expect(listTasks()).toHaveLength(0)
    expect(listActivity()[0]).toMatchObject({ status: 'denied', source: 'automation' })
  })

  it('rutin izni varsa değişikliği onaysız yapar', async () => {
    const events: ChatEvent[] = []
    await run(
      'gorev_ekle',
      { baslik: 'İzinli rutin' },
      context(events, { source: 'automation', allowance: 'write' })
    )
    expect(events).toHaveLength(0)
    expect(listTasks()).toHaveLength(1)
  })

  it('okuma araçları rutinde de onay istemez; hatalar kayda "error" olarak geçer', async () => {
    const events: ChatEvent[] = []
    await run('gorevleri_listele', {}, context(events, { source: 'automation' }))
    await expect(
      run('gorev_tamamla', { id: 999 }, context(events, { source: 'chat' }))
    ).rejects.toThrow()

    expect(events).toHaveLength(0)
    const [failed, listed] = listActivity()
    expect(listed).toMatchObject({ name: 'gorevleri_listele', status: 'done' })
    expect(failed).toMatchObject({ name: 'gorev_tamamla', status: 'error' })
  })
})
