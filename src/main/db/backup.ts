import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { getDb, isDbOpen } from './index'
import type { BackupInfo } from '../../shared/api'

// Günlük yedek: asistan-2026-09-14.db
const DAILY_PATTERN = /^asistan-(\d{4})-(\d{2})-(\d{2})\.db$/
// Geri yüklemeden hemen önce alınan güvenlik yedeği: geri-yukleme-oncesi-2026-09-14-153012.db
const SAFETY_PATTERN = /^geri-yukleme-oncesi-\d{4}-\d{2}-\d{2}-\d{6}\.db$/

// Son 7 günlük yedek + daha eskilerden 4 haftalık yedek + son 3 güvenlik yedeği saklanır
const KEEP_DAILY = 7
const KEEP_WEEKLY = 4
const KEEP_SAFETY = 3

const pad = (n: number): string => String(n).padStart(2, '0')
const localDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export function dailyBackupName(date: Date): string {
  return `asistan-${localDate(date)}.db`
}

export function safetyBackupName(date: Date): string {
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `geri-yukleme-oncesi-${localDate(date)}-${time}.db`
}

const isBackupName = (name: string): boolean =>
  DAILY_PATTERN.test(name) || SAFETY_PATTERN.test(name)

/** Günlük yedeğin ait olduğu haftanın pazartesisi (haftalık yedek seçimi için) */
function weekOf(name: string): string {
  const [, year, month, day] = DAILY_PATTERN.exec(name) ?? []
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return localDate(date)
}

/** Saklama kuralına göre silinmesi gereken yedeklerin adları */
export function selectExpiredBackups(names: string[]): string[] {
  // Adlar tarihle başladığı için ters alfabetik sıra = en yeni başta
  const daily = names
    .filter((name) => DAILY_PATTERN.test(name))
    .sort()
    .reverse()
  const safety = names
    .filter((name) => SAFETY_PATTERN.test(name))
    .sort()
    .reverse()

  const keep = new Set([...daily.slice(0, KEEP_DAILY), ...safety.slice(0, KEEP_SAFETY)])
  const coveredWeeks = new Set(daily.slice(0, KEEP_DAILY).map(weekOf))
  let weekly = 0
  for (const name of daily.slice(KEEP_DAILY)) {
    if (weekly >= KEEP_WEEKLY) break
    const week = weekOf(name)
    if (coveredWeeks.has(week)) continue
    coveredWeeks.add(week)
    keep.add(name)
    weekly++
  }
  return names.filter((name) => isBackupName(name) && !keep.has(name))
}

export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(isBackupName)
    .map((name) => {
      const stats = statSync(join(dir, name))
      return { name, createdAt: stats.mtimeMs, size: stats.size }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Açık veritabanının tutarlı bir kopyasını alır (uygulama çalışırken de güvenli).
 * Önce geçici dosyaya yazılır; yarıda kalan yedek geçerli yedek gibi görünmesin.
 */
export async function createBackup(dir: string, name: string): Promise<BackupInfo> {
  if (!isBackupName(name)) throw new Error('Geçersiz yedek adı.')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, name)
  const partial = `${target}.part`
  rmSync(partial, { force: true })
  await getDb().backup(partial)
  // Yedek alınır alınmaz doğrulanır: bozuk bir yedek, ihtiyaç anında "sağlam yedek" sanılmasın
  const problem = backupProblem(partial)
  if (problem) {
    rmSync(partial, { force: true })
    throw new Error(`Alınan yedek doğrulanamadı: ${problem}`)
  }
  renameSync(partial, target)
  const stats = statSync(target)
  return { name, createdAt: stats.mtimeMs, size: stats.size }
}

/** Saklama süresi dolan yedekleri siler, silinenlerin adlarını döndürür */
export function pruneBackups(dir: string): string[] {
  if (!existsSync(dir)) return []
  const expired = selectExpiredBackups(readdirSync(dir))
  for (const name of expired) rmSync(join(dir, name), { force: true })
  return expired
}

/**
 * Veritabanı dosyasını yedekle değiştirir. Veritabanı kapalıyken çağrılmalı.
 * `keepCurrentAs` verilirse mevcut dosya (WAL ile birlikte) silinmez, bu adla saklanır.
 */
export function replaceDatabaseFile(
  dbPath: string,
  backupPath: string,
  keepCurrentAs?: string
): void {
  if (isDbOpen()) throw new Error('Veritabanı açıkken yedekten geri yükleme yapılamaz.')
  if (!existsSync(backupPath)) throw new Error('Yedek dosyası bulunamadı.')
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix
    if (!existsSync(file)) continue
    if (keepCurrentAs) renameSync(file, keepCurrentAs + suffix)
    else rmSync(file, { force: true })
  }
  copyFileSync(backupPath, dbPath)
}

export interface BackupSummary {
  conversations: number
  messages: number
  memories: number
  /** Son mesajın zamanı (veritabanındaki UTC metni); hiç mesaj yoksa null */
  lastMessageAt: string | null
}

/** Yedek dosyasını salt okunur açıp bütünlüğünü denetler; sağlamsa null, değilse sorun metni */
export function backupProblem(path: string): string | null {
  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
    const rows = db.pragma('integrity_check') as { integrity_check: string }[]
    const result = rows.map((row) => row.integrity_check).join('\n')
    return result === 'ok' ? null : result
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  } finally {
    db?.close()
  }
}

/**
 * Yedeğin içinde ne olduğu (geri yükleme penceresinde gösterilir). 2026-09-30'da sağlam ama başka bir
 * geçmişe ait yedek neredeyse geri yükleniyordu; sayılar kullanıcının doğru yedeği tanımasını sağlar.
 */
export function summarizeBackup(path: string): BackupSummary | null {
  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
    const count = (table: string): number =>
      (db!.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
    const last = db.prepare('SELECT max(created_at) AS at FROM messages').get() as {
      at: string | null
    }
    return {
      conversations: count('conversations'),
      messages: count('messages'),
      memories: count('memories'),
      lastMessageAt: last.at
    }
  } catch {
    return null
  } finally {
    db?.close()
  }
}
