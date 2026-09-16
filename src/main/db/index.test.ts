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
    expect(version).toBe(9)
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
})
