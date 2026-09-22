import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb, initDatabase } from './db'
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

describe('bozuk kayıtlı ayar', () => {
  it('JSON.parse hata verirse çökmez, varsayılanlara döner ve bozuk veriyi ayrı saklar', () => {
    initDatabase(':memory:')
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('app', '{bozuk json')").run()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const settings = getSettings()
    expect(settings.provider).toBe('ollama')
    expect(settings.tone).toBe('dengeli')

    const corrupt = getDb()
      .prepare("SELECT value FROM settings WHERE key LIKE 'app:corrupt:%'")
      .get() as { value: string } | undefined
    expect(corrupt?.value).toBe('{bozuk json')

    vi.restoreAllMocks()
  })
})
