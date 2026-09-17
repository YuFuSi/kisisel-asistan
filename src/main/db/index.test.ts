import { afterEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from './index'

afterEach(() => closeDb())

function columnNames(table: string): string[] {
  const rows = getDb().pragma(`table_info(${table})`) as { name: string }[]
  return rows.map((row) => row.name)
}

describe('migrations', () => {
  it('en son sürüme kadar sorunsuz uygulanır', () => {
    initDatabase(':memory:')
    const version = getDb().pragma('user_version', { simple: true }) as number
    expect(version).toBe(10)
  })

  it('memories ve notes tablolarına embedding sütunları ekler (migration 9)', () => {
    initDatabase(':memory:')
    expect(columnNames('memories')).toEqual(
      expect.arrayContaining(['embedding', 'embedding_updated_at'])
    )
    expect(columnNames('notes')).toEqual(
      expect.arrayContaining(['embedding', 'embedding_updated_at'])
    )
  })

  it('automations ve automation_runs tablolarını oluşturur (migration 10)', () => {
    initDatabase(':memory:')
    expect(columnNames('automations')).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'prompt',
        'time_of_day',
        'repeat',
        'allowance',
        'enabled',
        'next_run_at',
        'last_run_at',
        'created_at'
      ])
    )
    expect(columnNames('automation_runs')).toEqual(
      expect.arrayContaining([
        'id',
        'automation_id',
        'started_at',
        'finished_at',
        'status',
        'summary',
        'skipped_tools'
      ])
    )
  })
})
