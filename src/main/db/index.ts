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
  `,
  // 8: Görevlerde isteğe bağlı saat (sadece son tarih varsa anlamlı)
  `
  ALTER TABLE tasks ADD COLUMN due_time TEXT;
  `,
  // 9: Anlamsal arama için embedding sütunları (BLOB: Float32Array baytları).
  // NULL = henüz hesaplanmadı. embedding_updated_at, içerik değişip embedding'in
  // eskidiğini anlamak için ayrı tutulur (created_at/updated_at ile karıştırılmasın).
  `
  ALTER TABLE memories ADD COLUMN embedding BLOB;
  ALTER TABLE memories ADD COLUMN embedding_updated_at TEXT;
  ALTER TABLE notes ADD COLUMN embedding BLOB;
  ALTER TABLE notes ADD COLUMN embedding_updated_at TEXT;
  `,
  // 10: Otomasyon motoru (Tur J). Kullanıcının kurduğu, zaman tabanlı ve serbest metin
  // talimatlı rutinler. repeat: 'none' olan bir kere çalışınca silinmez, enabled=0 olur
  // (geçmişi automation_runs'ta görünür kalsın diye). automation_id yabancı anahtar
  // CASCADE: otomasyon silinince geçmişi de silinir (activity_log'un aksine, burada
  // otomasyonsuz bir çalıştırma kaydının anlamı yok).
  `
  CREATE TABLE automations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    prompt       TEXT NOT NULL,
    time_of_day  TEXT NOT NULL,
    repeat       TEXT NOT NULL DEFAULT 'none',
    allowance    TEXT NOT NULL DEFAULT 'none',
    enabled      INTEGER NOT NULL DEFAULT 1,
    next_run_at  INTEGER NOT NULL,
    last_run_at  INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_automations_due ON automations(enabled, next_run_at);

  CREATE TABLE automation_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id  INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    started_at     INTEGER NOT NULL,
    finished_at    INTEGER,
    status         TEXT NOT NULL,
    summary        TEXT NOT NULL DEFAULT '',
    skipped_tools  TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX idx_automation_runs_automation ON automation_runs(automation_id, started_at);
  `,
  // 11: Güçlü hafıza. Kayıt türü, nereden öğrenildiği ve kullanım zamanı; otomatik öğrenilenler
  // gözden geçirilene kadar reviewed = 0. source_conversation_id yabancı anahtar değil: sohbet
  // silinse de öğrenilen bilgi kalır. Sohbet başına tarihli özet (konuşma hafızası) ayrı tabloda,
  // sohbet silinince özeti de silinir.
  `
  ALTER TABLE memories ADD COLUMN kind TEXT NOT NULL DEFAULT 'bilgi';
  ALTER TABLE memories ADD COLUMN source TEXT NOT NULL DEFAULT 'arac';
  ALTER TABLE memories ADD COLUMN source_conversation_id INTEGER;
  ALTER TABLE memories ADD COLUMN updated_at TEXT;
  ALTER TABLE memories ADD COLUMN last_used_at TEXT;
  ALTER TABLE memories ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 1;

  CREATE TABLE conversation_digests (
    conversation_id      INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    summary              TEXT NOT NULL,
    processed_until      INTEGER NOT NULL,
    started_at           TEXT NOT NULL,
    ended_at             TEXT NOT NULL,
    embedding            BLOB,
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  // 12: Asistan cevabının sonucu (tamamlandı, kısmen, reddedildi, süre doldu, durduruldu, hata);
  // arayüz geçmişteki işlemlerin nasıl bittiğini buradan okur
  `
  ALTER TABLE messages ADD COLUMN outcome TEXT;
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
