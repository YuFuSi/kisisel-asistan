import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db'
import {
  computeNextRun,
  createAutomation,
  deleteAutomation,
  finishAutomationRun,
  listAutomationRuns,
  listAutomations,
  recordAutomationRunStart,
  takeDueAutomations,
  updateAutomation
} from './automations'

beforeEach(() => initDatabase(':memory:'))
afterEach(() => closeDb())

// Doğrudan next_run_at'ı geçmişe yazar; gerçek zaman beklemeden "zamanı gelmiş" senaryosu kurar
function backdate(id: number, next_run_at: number): void {
  getDb().prepare('UPDATE automations SET next_run_at = ? WHERE id = ?').run(next_run_at, id)
}

describe('createAutomation / listAutomations / updateAutomation / deleteAutomation', () => {
  it('varsayılan repeat/allowance ile oluşturur ve sıradaki zamanı hesaplar', () => {
    const now = new Date('2026-09-17T08:00:00').getTime()
    const automation = createAutomation(
      { name: 'Sabah özeti', prompt: 'Günlük özetimi hazırla.', timeOfDay: '09:00' },
      now
    )
    expect(automation.repeat).toBe('none')
    expect(automation.allowance).toBe('none')
    expect(automation.enabled).toBe(true)
    expect(automation.nextRunAt).toBeGreaterThan(now)
  })

  it('geçersiz saat veya isimde Türkçe hata verir', () => {
    expect(() => createAutomation({ name: '', prompt: 'x', timeOfDay: '09:00' })).toThrow(
      'Rutin adı boş olamaz.'
    )
    expect(() => createAutomation({ name: 'x', prompt: 'x', timeOfDay: '25:00' })).toThrow(
      'Saat SS:DD biçiminde olmalı.'
    )
  })

  it('listAutomations sıradaki zamana göre sıralar', () => {
    // Sabah 00:00 referans alınır ki her iki saat de aynı gün içinde kalsın
    const now = new Date('2026-09-17T00:00:00').getTime()
    createAutomation({ name: 'Geç', prompt: 'x', timeOfDay: '20:00' }, now)
    createAutomation({ name: 'Erken', prompt: 'x', timeOfDay: '06:00' }, now)
    const names = listAutomations().map((a) => a.name)
    expect(names[0]).toBe('Erken')
  })

  it('updateAutomation alanları günceller, saat değişince sıradaki zamanı yeniden hesaplar', () => {
    const now = new Date('2026-09-17T08:00:00').getTime()
    const created = createAutomation(
      { name: 'Rutin', prompt: 'x', timeOfDay: '09:00', repeat: 'daily' },
      now
    )
    const updated = updateAutomation(created.id, { timeOfDay: '10:00' }, now)
    expect(updated.timeOfDay).toBe('10:00')
    expect(updated.nextRunAt).not.toBe(created.nextRunAt)
  })

  it('deleteAutomation kaldırır', () => {
    const created = createAutomation({ name: 'Sil', prompt: 'x', timeOfDay: '09:00' })
    deleteAutomation(created.id)
    expect(listAutomations()).toHaveLength(0)
  })
})

describe('computeNextRun', () => {
  it('none için de gelecekteki bir zaman döner (ilk çalışma zamanı)', () => {
    const now = new Date('2026-09-17T08:00:00').getTime()
    const next = computeNextRun('09:00', 'none', now)
    expect(next).toBeGreaterThan(now)
  })
})

describe('takeDueAutomations', () => {
  it('tek seferlik (none) bir rutin çalışınca enabled=0 olur, silinmez', () => {
    const created = createAutomation({ name: 'Tek seferlik', prompt: 'x', timeOfDay: '09:00' })
    backdate(created.id, Date.now() - 1000)

    const due = takeDueAutomations(Date.now())
    expect(due).toHaveLength(1)
    expect(due[0].enabled).toBe(false)

    const [stored] = listAutomations()
    expect(stored.enabled).toBe(false)
  })

  it('tekrarlayan bir rutin bir sonraki zamana atlar, enabled kalır', () => {
    const created = createAutomation({
      name: 'Günlük',
      prompt: 'x',
      timeOfDay: '09:00',
      repeat: 'daily'
    })
    const now = Date.now()
    backdate(created.id, now - 1000)

    const due = takeDueAutomations(now)
    expect(due).toHaveLength(1)
    expect(due[0].enabled).toBe(true)
    expect(due[0].nextRunAt).toBeGreaterThan(now)

    const [stored] = listAutomations()
    expect(stored.enabled).toBe(true)
    expect(stored.lastRunAt).toBe(now)
  })

  it('zamanı gelmemiş rutini döndürmez', () => {
    createAutomation({ name: 'Gelecek', prompt: 'x', timeOfDay: '09:00' })
    expect(takeDueAutomations(Date.now())).toHaveLength(0)
  })

  it('kapalı (enabled=0) rutini döndürmez', () => {
    const created = createAutomation({ name: 'Kapalı', prompt: 'x', timeOfDay: '09:00' })
    updateAutomation(created.id, { enabled: false })
    backdate(created.id, Date.now() - 1000)
    expect(takeDueAutomations(Date.now())).toHaveLength(0)
  })
})

describe('automation run kaydı', () => {
  it('başlatılır, bitirilir ve en yenisi başta listelenir', () => {
    const automation = createAutomation({ name: 'Rutin', prompt: 'x', timeOfDay: '09:00' })
    const runId = recordAutomationRunStart(automation.id, 1000)
    finishAutomationRun(runId, { status: 'done', summary: 'Tamamlandı.', skippedTools: [] }, 2000)

    const [run] = listAutomationRuns(automation.id)
    expect(run).toMatchObject({
      automationId: automation.id,
      startedAt: 1000,
      finishedAt: 2000,
      status: 'done',
      summary: 'Tamamlandı.',
      skippedTools: []
    })
  })

  it('atlanan araçları JSON olarak saklar ve geri okur', () => {
    const automation = createAutomation({ name: 'Rutin', prompt: 'x', timeOfDay: '09:00' })
    const runId = recordAutomationRunStart(automation.id)
    finishAutomationRun(runId, {
      status: 'done',
      summary: 'Bazı adımlar atlandı.',
      skippedTools: [{ tool: 'eposta_gonder', label: 'E-posta gönderme' }]
    })

    const [run] = listAutomationRuns(automation.id)
    expect(run.skippedTools).toEqual([{ tool: 'eposta_gonder', label: 'E-posta gönderme' }])
  })
})
