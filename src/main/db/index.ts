import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

// Her eleman bir veritabanı sürümü. Yeni tablo/sütun gerekirse sona yeni bir eleman eklenir,
// mevcutlar asla değiştirilmez (kullanıcının eski veritabanı sırayla güncellenir).
const migrations: string[] = [
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_messages_conversation ON messages(conversation_id, id);
  `
]

let db: Database.Database | null = null

export function openDatabase(path: string): Database.Database {
  const database = new Database(path)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  migrate(database)
  return database
}

function migrate(database: Database.Database): void {
  const version = database.pragma('user_version', { simple: true }) as number
  for (let i = version; i < migrations.length; i++) {
    database.transaction(() => {
      database.exec(migrations[i])
      database.pragma(`user_version = ${i + 1}`)
    })()
  }
}

// Veritabanı dosyası: %APPDATA%\kisisel-asistan\asistan.db
export function getDb(): Database.Database {
  db ??= openDatabase(join(app.getPath('userData'), 'asistan.db'))
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
