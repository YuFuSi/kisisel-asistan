import { describe, expect, it } from 'vitest'
import {
  backlogGrowthNotificationText,
  detectBacklogGrowth,
  detectEmbeddingBacklog,
  embeddingBacklogNotificationText,
  findStaleFiredReminders,
  findStaleTasks,
  isProactiveNudgeDue,
  isWeeklyNudgeDue,
  staleReminderNotificationText,
  staleTaskNotificationText
} from './proactive'
import type { Reminder, Task } from '../../shared/api'

const DAY_MS = 24 * 60 * 60 * 1000

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Görev',
    notes: '',
    dueDate: null,
    dueTime: null,
    doneAt: null,
    createdAt: '2026-09-10 08:00:00',
    ...overrides
  }
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 1,
    message: 'Hatırlatma',
    remindAt: new Date('2026-09-10T08:00:00Z').getTime(),
    sentAt: new Date('2026-09-10T08:00:00Z').getTime(),
    repeat: 'none',
    ...overrides
  }
}

describe('findStaleTasks', () => {
  it('3 günden yeni görevleri saymaz', () => {
    const now = new Date('2026-09-12T08:00:00Z')
    expect(findStaleTasks([task({ createdAt: '2026-09-10 08:00:00' })], now)).toBeNull()
  })

  it('tam olarak 3 gün önce oluşturulan görevi eski sayar', () => {
    const now = new Date('2026-09-13T08:00:00Z')
    const stale = task({ id: 5, createdAt: '2026-09-10 08:00:00' })
    expect(findStaleTasks([stale], now)).toEqual({ count: 1, oldest: stale })
  })

  it('tamamlanan görevleri yok sayar', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const done = task({ createdAt: '2026-09-01 08:00:00', doneAt: '2026-09-05 08:00:00' })
    expect(findStaleTasks([done], now)).toBeNull()
  })

  it('birden fazla eski görev varsa en eskisini ve sayıyı döner', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const yeni = task({ id: 1, createdAt: '2026-09-19 08:00:00' })
    const orta = task({ id: 2, createdAt: '2026-09-14 08:00:00' })
    const enEski = task({ id: 3, createdAt: '2026-09-01 08:00:00' })
    expect(findStaleTasks([yeni, orta, enEski], now)).toEqual({ count: 2, oldest: enEski })
  })

  it('özel eşik (staleMs) verilirse onu kullanır', () => {
    const now = new Date('2026-09-11T08:00:00Z')
    const t = task({ createdAt: '2026-09-10 08:00:00' })
    expect(findStaleTasks([t], now, DAY_MS)).toEqual({ count: 1, oldest: t })
  })
})

describe('staleTaskNotificationText', () => {
  it('tek görevde başlığı tekil cümlede kullanır', () => {
    const info = { count: 1, oldest: task({ title: 'Faturayı öde' }) }
    expect(staleTaskNotificationText(info).body).toContain('"Faturayı öde"')
    expect(staleTaskNotificationText(info).body).not.toContain('dahil')
  })

  it('birden fazla görevde sayıyı ve "dahil" ifadesini ekler', () => {
    const info = { count: 3, oldest: task({ title: 'Faturayı öde' }) }
    expect(staleTaskNotificationText(info).body).toContain('3 görev')
    expect(staleTaskNotificationText(info).body).toContain('dahil')
  })
})

describe('findStaleFiredReminders', () => {
  it('24 saatten yeni çalmış hatırlatmayı saymaz', () => {
    const now = new Date('2026-09-11T00:00:00Z')
    expect(
      findStaleFiredReminders(
        [reminder({ sentAt: new Date('2026-09-10T08:00:00Z').getTime() })],
        now
      )
    ).toBeNull()
  })

  it('tam 24 saat önce çalmış tek seferlik hatırlatmayı eski sayar', () => {
    const now = new Date('2026-09-11T08:00:00Z')
    const stale = reminder({ id: 5, sentAt: new Date('2026-09-10T08:00:00Z').getTime() })
    expect(findStaleFiredReminders([stale], now)).toEqual({ count: 1, oldest: stale })
  })

  it('henüz çalmamış hatırlatmayı (sentAt null) yok sayar', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    expect(findStaleFiredReminders([reminder({ sentAt: null })], now)).toBeNull()
  })

  it('tekrarlayan hatırlatmayı yok sayar (sürekli "çalmış" olması normal)', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const gunluk = reminder({
      repeat: 'daily',
      sentAt: new Date('2026-09-01T08:00:00Z').getTime()
    })
    expect(findStaleFiredReminders([gunluk], now)).toBeNull()
  })

  it('birden fazla eski hatırlatma varsa en eskisini ve sayıyı döner', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const yeni = reminder({ id: 1, sentAt: new Date('2026-09-19T08:00:00Z').getTime() })
    const enEski = reminder({ id: 2, sentAt: new Date('2026-09-01T08:00:00Z').getTime() })
    expect(findStaleFiredReminders([yeni, enEski], now)).toEqual({ count: 2, oldest: enEski })
  })
})

describe('staleReminderNotificationText', () => {
  it('tek hatırlatmada mesajı tekil cümlede kullanır', () => {
    const info = { count: 1, oldest: reminder({ message: 'Vitamin al' }) }
    expect(staleReminderNotificationText(info).body).toContain('"Vitamin al"')
    expect(staleReminderNotificationText(info).body).not.toContain('dahil')
  })

  it('birden fazla hatırlatmada sayıyı ve "dahil" ifadesini ekler', () => {
    const info = { count: 3, oldest: reminder({ message: 'Vitamin al' }) }
    expect(staleReminderNotificationText(info).body).toContain('3 hatırlatma')
    expect(staleReminderNotificationText(info).body).toContain('dahil')
  })
})

describe('isProactiveNudgeDue', () => {
  it('bugün hiç gösterilmediyse doğru döner', () => {
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), null)).toBe(true)
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), '2026-09-15')).toBe(true)
  })

  it('bugün zaten gösterildiyse yanlış döner', () => {
    expect(isProactiveNudgeDue(new Date('2026-09-16T10:00:00'), '2026-09-16')).toBe(false)
  })
})

describe('isWeeklyNudgeDue', () => {
  it('hiç gösterilmediyse doğru döner', () => {
    expect(isWeeklyNudgeDue(new Date('2026-09-16T10:00:00'), null)).toBe(true)
  })

  it('7 günden az zaman geçtiyse yanlış döner', () => {
    expect(isWeeklyNudgeDue(new Date('2026-09-16T10:00:00'), '2026-09-10')).toBe(false)
  })

  it('tam 7 gün geçtiyse doğru döner', () => {
    expect(isWeeklyNudgeDue(new Date('2026-09-17T10:00:00'), '2026-09-10')).toBe(true)
  })
})

describe('detectBacklogGrowth', () => {
  it('açık görev sayısı eşiğin altındaysa tetiklenmez', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const tasks = [task({ id: 1 }), task({ id: 2 })]
    expect(detectBacklogGrowth(tasks, now)).toBeNull()
  })

  it('açık görev sayısı yeterli ama son 7 günde tamamlanan varsa tetiklenmez', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const tasks = [1, 2, 3, 4, 5].map((id) => task({ id }))
    tasks.push(task({ id: 6, doneAt: new Date('2026-09-19T08:00:00Z').toISOString() }))
    expect(detectBacklogGrowth(tasks, now)).toBeNull()
  })

  it('açık görev sayısı yeterli ve son 7 günde hiç tamamlanan yoksa tetiklenir', () => {
    const now = new Date('2026-09-20T08:00:00Z')
    const tasks = [1, 2, 3, 4, 5].map((id) => task({ id }))
    tasks.push(task({ id: 6, doneAt: new Date('2026-08-01T08:00:00Z').toISOString() }))
    expect(detectBacklogGrowth(tasks, now)).toEqual({ openCount: 5 })
  })
})

describe('backlogGrowthNotificationText', () => {
  it('açık görev sayısını mesaja ekler', () => {
    expect(backlogGrowthNotificationText({ openCount: 7 }).body).toContain('7 açık görevin')
  })
})

describe('detectEmbeddingBacklog', () => {
  it('eksik kayıt yoksa null döner', () => {
    expect(detectEmbeddingBacklog(0)).toBeNull()
  })

  it('eksik kayıt varsa sayısını döner', () => {
    expect(detectEmbeddingBacklog(4)).toEqual({ missingCount: 4 })
  })
})

describe('embeddingBacklogNotificationText', () => {
  it('eksik kayıt sayısını mesaja ekler', () => {
    expect(embeddingBacklogNotificationText({ missingCount: 4 }).body).toContain('4 kayıt')
  })
})
