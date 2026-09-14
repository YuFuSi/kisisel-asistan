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
  `,
  // 5: Tekrarlayan hatırlatmalar (none / daily / weekdays / weekly)
  `
  ALTER TABLE reminders ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none';
  `,
  // 6: Uzun sohbet özetinin hangi mesaja kadar olan kısmı kapsadığı
  `
  ALTER TABLE conversations ADD COLUMN summary_until INTEGER NOT NULL DEFAULT 0;
  `,
  // 7: Etkinlik kaydı (araç çağrıları; "Son işlemler" ve analizlerin kaynağı).
  // Sohbet silinse de kayıt kalsın diye conversation_id yabancı anahtar değil.
  `
  CREATE TABLE activity_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      INTEGER NOT NULL,
    source          TEXT NOT NULL,
    kind            TEXT NOT NULL,
    name            TEXT NOT NULL,
    label           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    detail          TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL,
    approval        TEXT,
    conversation_id INTEGER
  );

  CREATE INDEX idx_activity_created ON activity_log(created_at);
  `
]

let db: Database.Database | null = null

export function openDatabase(path: string): Database.Database {
  const database = new Database(path)
  try {
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
    migrate(database)
  } catch (err) {
    // Bozuk dosyada bağlantı açık kalırsa Windows dosyayı kilitler ve yedekten geri yükleme yapılamaz
    database.close()
    throw err
  }
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
  closeDb()
  db = openDatabase(path)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Veritabanı henüz açılmadı.')
  return db
}

export function isDbOpen(): boolean {
  return db !== null
}

/**
 * WAL dosyasında bekleyen değişiklikleri ana veritabanı dosyasına yazar ve WAL'i sıfırlar.
 * Uygulama düzgün kapanamasa bile (süreç öldürülürse, elektrik giderse) veri ana dosyada kalsın diye
 * düzenli aralıklarla çağrılır.
 */
export function checkpointDb(): void {
  db?.pragma('wal_checkpoint(TRUNCATE)')
}

/** Veritabanı sağlamsa 'ok', değilse bulunan sorunlar */
export function checkIntegrity(): string {
  const rows = getDb().pragma('integrity_check') as { integrity_check: string }[]
  return rows.map((row) => row.integrity_check).join('\n')
}

export function closeDb(): void {
  if (!db) return
  try {
    checkpointDb()
  } catch {
    // Aktarma başarısız olsa da bağlantı kapatılır; SQLite kapanışta WAL'i yine aktarmayı dener
  }
  db.close()
  db = null
}
