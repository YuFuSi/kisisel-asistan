import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkIntegrity, closeDb, initDatabase, isDbOpen } from './index'
import {
  backupProblem,
  createBackup,
  dailyBackupName,
  listBackups,
  pruneBackups,
  replaceDatabaseFile,
  safetyBackupName,
  selectExpiredBackups,
  summarizeBackup
} from './backup'
import { createTask, listTasks } from '../data/tasks'

// 14 Eylül 2026 pazartesi
const daysBefore = (days: number): string => {
  const date = new Date(2026, 8, 14)
  date.setDate(date.getDate() - days)
  return dailyBackupName(date)
}

describe('selectExpiredBackups', () => {
  it('son 7 günü ve daha önceki 4 haftanın birer yedeğini saklar', () => {
    const names = Array.from({ length: 60 }, (_, i) => daysBefore(i))
    const expired = new Set(selectExpiredBackups(names))
    const kept = names.filter((name) => !expired.has(name))
    expect(kept).toEqual([
      ...names.slice(0, 7),
      // 7 Eylül'ün haftası son 7 günde zaten var; sonraki haftaların en yenileri
      'asistan-2026-09-06.db',
      'asistan-2026-08-30.db',
      'asistan-2026-08-23.db',
      'asistan-2026-08-16.db'
    ])
  })

  it('son 3 güvenlik yedeğini saklar, yedek olmayan dosyalara dokunmaz', () => {
    const safety = [1, 2, 3, 4, 5].map((hour) =>
      safetyBackupName(new Date(2026, 8, 14, hour, 30, 0))
    )
    expect(selectExpiredBackups([...safety, 'notlar.txt', 'asistan.db'])).toEqual(
      safety.slice(0, 2)
    )
  })
})

describe('yedek dosyaları', () => {
  let dir: string
  let dbPath: string
  let backupDir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asistan-yedek-'))
    dbPath = join(dir, 'asistan.db')
    backupDir = join(dir, 'backups')
  })

  afterEach(() => {
    closeDb()
    rmSync(dir, { recursive: true, force: true })
  })

  it('yedek alır ve bozuk veritabanını yedekle değiştirir', async () => {
    initDatabase(dbPath)
    createTask({ title: 'Yedekteki görev' })
    const info = await createBackup(backupDir, daysBefore(0))
    expect(info.size).toBeGreaterThan(0)
    createTask({ title: 'Yedekten sonraki görev' })
    closeDb()

    // Dosya bozulursa veritabanı açılamaz ve açık bağlantı kalmaz (Windows dosyayı kilitlemesin)
    writeFileSync(dbPath, 'bozuk veri '.repeat(2000))
    expect(() => initDatabase(dbPath)).toThrow()
    expect(isDbOpen()).toBe(false)

    const corrupt = join(dir, 'asistan-bozuk.db')
    replaceDatabaseFile(dbPath, join(backupDir, info.name), corrupt)
    expect(existsSync(corrupt)).toBe(true)

    initDatabase(dbPath)
    expect(checkIntegrity()).toBe('ok')
    expect(listTasks().map((task) => task.title)).toEqual(['Yedekteki görev'])
  })

  it('yedeğin içeriğini özetler ve bozuk dosyayı yedek saymaz', async () => {
    initDatabase(dbPath)
    const info = await createBackup(backupDir, daysBefore(0))
    const path = join(backupDir, info.name)
    expect(backupProblem(path)).toBeNull()
    expect(summarizeBackup(path)).toEqual({
      conversations: 0,
      messages: 0,
      memories: 0,
      lastMessageAt: null
    })

    const broken = join(dir, 'bozuk.db')
    writeFileSync(broken, 'bozuk veri '.repeat(2000))
    expect(backupProblem(broken)).not.toBeNull()
    expect(summarizeBackup(broken)).toBeNull()
  })

  it('veritabanı açıkken dosyayı değiştirmez', async () => {
    initDatabase(dbPath)
    const info = await createBackup(backupDir, daysBefore(0))
    expect(() => replaceDatabaseFile(dbPath, join(backupDir, info.name))).toThrow('açıkken')
  })

  it('eski yedekleri siler, listede sadece yedekleri gösterir', () => {
    mkdirSync(backupDir)
    for (let i = 0; i < 10; i++) writeFileSync(join(backupDir, daysBefore(i)), 'x')
    writeFileSync(join(backupDir, 'baska.txt'), 'x')

    expect(pruneBackups(backupDir).sort()).toEqual([
      'asistan-2026-09-05.db',
      'asistan-2026-09-07.db'
    ])
    const names = listBackups(backupDir).map((backup) => backup.name)
    expect(names).toHaveLength(8)
    expect(names).not.toContain('baska.txt')
  })
})
