import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { listAutomations } from '../data/automations'
import { runWithToolContext, type ToolContext } from './context'
import { getAssistantTools } from './index'

vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))

beforeEach(() => initDatabase(':memory:'))
afterEach(() => closeDb())

const context: ToolContext = { conversationId: 1, source: 'chat' }
// AI SDK'nın araca verdiği ikinci parametre; bu araçlar kullanmıyor
const options = { toolCallId: 'test', messages: [] } as never

async function run(name: string, input: unknown): Promise<unknown> {
  const execute = getAssistantTools()[name]?.execute
  if (!execute) throw new Error(`${name} aracı yok`)
  return runWithToolContext(context, () => execute(input, options))
}

describe('rutin_olustur', () => {
  it('talimat ve saat verilince varsayılan tekrar/izinle oluşturur', async () => {
    const result = (await run('rutin_olustur', {
      ad: 'Sabah özeti',
      talimat: 'Günlük özetimi hazırla',
      saat: '09:00'
    })) as { ad: string; saat: string; izin: string }

    expect(result).toMatchObject({ ad: 'Sabah özeti', saat: '09:00', izin: 'none' })
    const [stored] = listAutomations()
    expect(stored).toMatchObject({
      name: 'Sabah özeti',
      prompt: 'Günlük özetimi hazırla',
      timeOfDay: '09:00',
      repeat: 'none',
      allowance: 'none'
    })
  })

  it('ad verilmezse talimattan türetir', async () => {
    await run('rutin_olustur', { talimat: 'Hava durumunu söyle', saat: '08:00' })
    expect(listAutomations()[0].name).toBe('Hava durumunu söyle')
  })

  it('tam tarih-saat verilirse sadece saati alır', async () => {
    await run('rutin_olustur', { talimat: 'x', saat: '2026-09-20T14:30' })
    expect(listAutomations()[0].timeOfDay).toBe('14:30')
  })

  it('takma alan adlarını ve Türkçe tekrar/izin değerlerini kabul eder', async () => {
    await run('rutin_olustur', {
      gorev: 'Yedek al',
      zaman: '23:00',
      tekrar: 'her_gun',
      izin: 'tam'
    })
    expect(listAutomations()[0]).toMatchObject({
      prompt: 'Yedek al',
      repeat: 'daily',
      allowance: 'all'
    })
  })

  it('anlaşılmayan izin değeri en güvenli seçeneğe (none) düşer, en izinliye değil', async () => {
    await run('rutin_olustur', { talimat: 'x', saat: '09:00', izin: 'bilinmeyen bir şey' })
    expect(listAutomations()[0].allowance).toBe('none')
  })

  it('talimat eksikse Türkçe hata verir', async () => {
    await expect(run('rutin_olustur', { saat: '09:00' })).rejects.toThrow('talimat')
  })

  it('saat eksikse veya geçersizse Türkçe hata verir', async () => {
    await expect(run('rutin_olustur', { talimat: 'x' })).rejects.toThrow('saat')
    await expect(run('rutin_olustur', { talimat: 'x', saat: '25:99' })).rejects.toThrow(
      'SS:DD biçiminde'
    )
  })
})

describe('rutinleri_listele ve rutin_iptal', () => {
  it('oluşturulan rutinleri listeler ve iptal edilince kaldırır', async () => {
    await run('rutin_olustur', { talimat: 'x', saat: '09:00' })
    const { rutinler } = (await run('rutinleri_listele', {})) as {
      rutinler: { id: number; talimat: string }[]
    }
    expect(rutinler).toHaveLength(1)
    expect(rutinler[0].talimat).toBe('x')

    await run('rutin_iptal', { id: rutinler[0].id })
    expect(listAutomations()).toHaveLength(0)
  })
})
