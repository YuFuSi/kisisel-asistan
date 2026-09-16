import { afterEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from './db'
import { getSettings, updateSettings } from './settings'

afterEach(() => closeDb())

describe('semanticSearchEnabled', () => {
  it('varsayılan olarak kapalıdır', () => {
    initDatabase(':memory:')
    expect(getSettings().semanticSearchEnabled).toBe(false)
  })

  it('açılıp kapatılabilir ve kalıcıdır', () => {
    initDatabase(':memory:')
    updateSettings({ semanticSearchEnabled: true })
    expect(getSettings().semanticSearchEnabled).toBe(true)

    updateSettings({ semanticSearchEnabled: false })
    expect(getSettings().semanticSearchEnabled).toBe(false)
  })
})
