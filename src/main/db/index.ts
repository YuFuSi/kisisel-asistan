import Database from 'better-sqlite3'

// Her eleman bir veritabanı sürümü. Yeni tablo/sütun gerekirse sona yeni bir eleman eklenir,
// mevcutlar asla değiştirilmez (kullanıcının eski veritabanı sırayla güncellenir).
const migrations: string[] = [
  // 1: Ayarlar ve sohbetler
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
  `,
  // 2: Araç etkinlikleri, görevler, hatırlatmalar, notlar, hafıza
  `
  ALTER TABLE messages ADD COLUMN tools TEXT NOT NULL DEFAULT '[]';

  CREATE TABLE tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    notes      TEXT NOT NULL DEFAULT '',
    due_date   TEXT,
    done_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message    TEXT NOT NULL,
    remind_at  INTEGER NOT NULL,
    sent_at    INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_reminders_pending ON reminders(sent_at, remind_at);

  CREATE TABLE notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE memories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  // 3: Sohbet sabitleme ve (uzun sohbet özeti için) özet alanı
  `
  ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE conversations ADD COLUMN summary TEXT NOT NULL DEFAULT '';
  `,
  // 4: Başlığı model mi verdi (1) yoksa kullanıcı mı adlandırdı (0)
  `
  ALTER TABLE conversations ADD COLUMN title_auto INTEGER NOT NULL DEFAULT 1;
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

// Uygulama açılırken bir kez çağrılır. Testlerde ':memory:' ile geçici veritabanı açılır.
// (Bu dosya electron'u import etmez; böylece veri katmanı testlerde de çalışır.)
export function initDatabase(path: string): void {
  db?.close()
  db = openDatabase(path)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Veritabanı henüz açılmadı.')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
