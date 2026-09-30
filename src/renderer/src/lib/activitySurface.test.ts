import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage, ToolActivity } from '../../../shared/api'
import {
  type ActivityOutcomes,
  activityRecordKey,
  activitySummary,
  formatActivityInput,
  forgetConversationOutcomes,
  readActivityOutcomes,
  rememberActivityOutcome,
  saveActivityOutcomes,
  splitActivitySteps
} from './activitySurface'

const tools: ToolActivity[] = Array.from({ length: 6 }, (_, index) => ({
  id: String(index),
  name: 'test',
  label: `Adım ${index}`,
  status: index === 5 ? 'running' : 'done'
}))
const message: ChatMessage = {
  id: 9,
  conversationId: 1,
  role: 'assistant',
  content: '',
  tools,
  createdAt: '2026-09-30T12:00:00',
  outcome: null
}

describe('Activity Surface', () => {
  it('son üç adımı açık bırakır, eski adımları sırasıyla ayırır', () => {
    const split = splitActivitySteps(tools)
    expect(split.recent.map((tool) => tool.id)).toEqual(['3', '4', '5'])
    expect(split.previous.map((tool) => tool.id)).toEqual(['0', '1', '2'])
    expect(splitActivitySteps([])).toEqual({ recent: [], previous: [] })
  })
  it('onayı çalışan adımdan önce gösterir; belirsiz ilerlemeye yüzde vermez', () => {
    expect(activitySummary(tools, true, true)).toBe('Onayını bekliyorum')
    expect(activitySummary(tools, true, false)).toBe('Adım 5')
    expect(activitySummary([], true, false)).toBe('Yanıt hazırlanıyor')
    expect(activitySummary(tools, false, false)).toBe('İşlem kaydı')
  })
  it('F0 sonuçlarını başarısız işi kutlamadan ayırır', () => {
    expect(activitySummary([], false, false, 'completed')).toBe('Tamamlandı')
    expect(activitySummary([], false, false, 'partial')).toBe('Kısmen tamamlandı')
    expect(activitySummary([], false, false, 'rejected')).toBe('Onay verilmedi')
    expect(activitySummary([], false, false, 'stopped')).toBe('Durduruldu')
    expect(activitySummary([], false, false, 'error')).toBe('İşlem tamamlanamadı')
  })
  it('girdiyi güvenli biçimde gösterir; bozuk nesne yüzeyi düşürmez', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatActivityInput(circular)).toBe('Girdi görüntülenemedi.')
    expect(formatActivityInput(undefined)).toBe('Girdi kaydedilmemiş.')
    expect(formatActivityInput(false)).toBe('false')
  })
  it('sonucu mesaj kimliği ve zamanıyla saklar; başka sohbete taşımaz', () => {
    const records = rememberActivityOutcome({}, message, 'stopped')
    expect(records[activityRecordKey(message)]).toBe('stopped')
    expect(records[activityRecordKey({ ...message, conversationId: 2 })]).toBeUndefined()
    expect(records[activityRecordKey({ ...message, createdAt: 'new' })]).toBeUndefined()
    expect(rememberActivityOutcome(records, message, 'stopped')).toBe(records)
  })
  it('sonuç indeksini sınırlar', () => {
    let records: ActivityOutcomes = {}
    for (let id = 0; id < 1002; id++)
      records = rememberActivityOutcome(records, { ...message, id }, 'completed')
    expect(Object.keys(records)).toHaveLength(1000)
    expect(records[activityRecordKey({ ...message, id: 0 })]).toBeUndefined()
  })
  it('silinen sohbetin sonuç izlerini kaldırır; başka sohbetler kalır', () => {
    const records = {
      ...rememberActivityOutcome({}, message, 'stopped'),
      ...rememberActivityOutcome({}, { ...message, conversationId: 12 }, 'completed')
    }
    const remaining = forgetConversationOutcomes(records, 1)
    expect(remaining[activityRecordKey(message)]).toBeUndefined()
    expect(remaining[activityRecordKey({ ...message, conversationId: 12 })]).toBe('completed')
  })
  it('depo bozuk veya kapalıyken işlem kaydı kullanılabilir kalır', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{bozuk',
      setItem: () => {
        throw new Error('kapalı')
      }
    })
    expect(readActivityOutcomes()).toEqual({})
    expect(() => saveActivityOutcomes({})).not.toThrow()
    vi.unstubAllGlobals()
  })
  it('eski/uydurma durumları yüklemez; yalnızca sonuç türünü kalıcı tutar', () => {
    let stored = JSON.stringify({ old: 'eski-durum', bad: 'constructor', valid: 'partial' })
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: (_key: string, value: string): void => {
        stored = value
      }
    })
    expect(readActivityOutcomes()).toEqual({ valid: 'partial' })
    saveActivityOutcomes(rememberActivityOutcome({}, message, 'rejected'))
    expect(readActivityOutcomes()[activityRecordKey(message)]).toBe('rejected')
    expect(stored).not.toContain('content')
    expect(stored).not.toContain('tools')
    vi.unstubAllGlobals()
  })
})
