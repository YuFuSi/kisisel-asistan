import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamText } from 'ai'
import { closeDb, initDatabase } from '../db'
import { updateSettings } from '../settings'
import { AutomationApprovalSkipped } from '../tools/approval'
import { runAutomationTurn } from './automation'

// Gerçek modele gitmez; her test kendi akışını verir (chat.test.ts ile aynı desen)
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, streamText: vi.fn() }
})

const mockStreamText = vi.mocked(streamText)

beforeEach(() => {
  initDatabase(':memory:')
  updateSettings({ models: { ollama: 'qwen3:14b' } })
  mockStreamText.mockReset()
})

afterEach(() => closeDb())

type Part = Record<string, unknown>

function streamOf(parts: Part[]): AsyncGenerator<Part> {
  return (async function* () {
    for (const part of parts) yield part
  })()
}

describe('runAutomationTurn', () => {
  it('metni parça parça birleştirir ve atlanan araç yoksa boş liste döner', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        { type: 'text-delta', text: 'Günlük özet: ' },
        { type: 'text-delta', text: 'hava güneşli.' }
      ])
    } as never)

    const result = await runAutomationTurn('Günümü özetle', 'write', -1)
    expect(result.text).toBe('Günlük özet: hava güneşli.')
    expect(result.skipped).toEqual([])
    expect(result.usedTools).toBe(false)
  })

  it('en az bir araç çağrılırsa usedTools true döner', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        { type: 'tool-call', toolName: 'gorev_ekle', toolCallId: '1', input: {} },
        { type: 'text-delta', text: 'Görev eklendi.' }
      ])
    } as never)

    const result = await runAutomationTurn('görev ekle', 'write', -1)
    expect(result.usedTools).toBe(true)
  })

  it('adım aralarında ayraç ekler', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        { type: 'text-delta', text: 'İlk cümle.' },
        { type: 'finish-step' },
        { type: 'text-delta', text: 'İkinci cümle.' }
      ])
    } as never)

    const result = await runAutomationTurn('x', 'none', -1)
    expect(result.text).toBe('İlk cümle.\n\nİkinci cümle.')
  })

  it('izin yetersizliği nedeniyle atlanan bir aracı skipped listesine ekler, turu düşürmez', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        {
          type: 'tool-error',
          toolName: 'eposta_gonder',
          toolCallId: '1',
          error: new AutomationApprovalSkipped('E-posta gönderme')
        },
        { type: 'text-delta', text: 'E-posta gönderilemedi, izin yetersiz.' }
      ])
    } as never)

    const result = await runAutomationTurn('e-posta gönder', 'none', -1)
    expect(result.skipped).toEqual([{ tool: 'eposta_gonder', label: 'E-posta gönderme' }])
    expect(result.text).toContain('izin yetersiz')
  })

  it('sıradan bir araç hatası skipped listesine eklenmez', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([
        {
          type: 'tool-error',
          toolName: 'dosya_ac',
          toolCallId: '1',
          error: new Error('Dosya bulunamadı.')
        },
        { type: 'text-delta', text: 'Dosya bulunamadı.' }
      ])
    } as never)

    const result = await runAutomationTurn('dosya aç', 'all', -1)
    expect(result.skipped).toEqual([])
  })

  it('abort parçası gelirse zaman aşımı hatası fırlatır', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([{ type: 'abort' }])
    } as never)

    await expect(runAutomationTurn('x', 'none', -1)).rejects.toThrow('dakika içinde bitirmedi')
  })

  it('stream hatası fırlatırsa yukarı düşer', async () => {
    mockStreamText.mockReturnValue({
      stream: streamOf([{ type: 'error', error: new Error('Model hatası.') }])
    } as never)

    await expect(runAutomationTurn('x', 'none', -1)).rejects.toThrow('Model hatası.')
  })
})
