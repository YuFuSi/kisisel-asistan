import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { listActivity, logActivity, pruneActivity } from './activity'

beforeEach(() => initDatabase(':memory:'))
afterEach(() => closeDb())

describe('etkinlik kaydı', () => {
  it('kaydeder ve en yenisi başta listeler', () => {
    logActivity(
      {
        source: 'chat',
        name: 'gorev_ekle',
        label: 'Görev ekleme',
        status: 'done',
        conversationId: 4
      },
      1000
    )
    logActivity(
      {
        source: 'automation',
        name: 'uygulama_ac',
        label: 'Uygulama açma',
        summary: 'Not Defteri',
        status: 'denied',
        approval: null
      },
      2000
    )

    const [latest, first] = listActivity()
    expect(latest).toMatchObject({
      name: 'uygulama_ac',
      source: 'automation',
      status: 'denied',
      summary: 'Not Defteri',
      approval: null,
      conversationId: null
    })
    expect(first).toMatchObject({ name: 'gorev_ekle', createdAt: 1000, conversationId: 4 })
  })

  it('uzun metinleri kısaltır ve liste sınırına uyar', () => {
    for (let i = 0; i < 5; i++) {
      logActivity({
        source: 'chat',
        name: 'not_kaydet',
        label: 'Not kaydetme',
        summary: 'ö'.repeat(500),
        detail: 'x'.repeat(5000),
        status: 'done',
        approval: 'approved'
      })
    }
    const entries = listActivity(3)
    expect(entries).toHaveLength(3)
    expect(entries[0].summary).toHaveLength(200)
    expect(entries[0].detail).toHaveLength(1000)
    expect(entries[0].approval).toBe('approved')
  })

  it('eski kayıtları siler', () => {
    logActivity({ source: 'chat', name: 'a', label: 'A', status: 'done' }, 1000)
    logActivity({ source: 'chat', name: 'b', label: 'B', status: 'error' }, 5000)
    expect(pruneActivity(3000)).toBe(1)
    expect(listActivity().map((entry) => entry.name)).toEqual(['b'])
  })
})
