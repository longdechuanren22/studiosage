import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'studiosage.db');

let _db: SqlJsDatabase | null = null;
let _initPromise: Promise<SqlJsDatabase> | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _periodicTimer: ReturnType<typeof setInterval> | null = null;
let _dirty = false;

/** Initialize the database (idempotent — safe to call multiple times) */
export async function initDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      _db = new SQL.Database(buffer);
    } else {
      _db = new SQL.Database();
    }

    _db.run('PRAGMA foreign_keys = ON');
    runMigrations(_db);
    _startPeriodicSave();
    _setupShutdownHooks();
    return _db;
  })();

  return _initPromise;
}

/** Get the database instance (throws if not initialized) */
export function getDb(): SqlJsDatabase {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

/** Check if DB is ready without throwing */
export function isDbReady(): boolean {
  return _db !== null;
}

/** Mark DB dirty and schedule a flush to disk */
export function markDirty() {
  _dirty = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  // Debounced save: 500ms after last write, or immediate if many writes
  _saveTimer = setTimeout(() => saveDb(), 500);
}

/** Persist the in-memory database to disk immediately */
export function saveDb() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (!_db || !_dirty) return;
  try {
    const data = _db.export();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, data);
    _dirty = false;
  } catch (err) {
    console.error('[DB] save failed:', (err as Error).message);
  }
}

/** Force save regardless of dirty flag (used on shutdown) */
export function closeDb() {
  if (_periodicTimer) { clearInterval(_periodicTimer); _periodicTimer = null; }
  saveDb();
  try { _db?.close(); } catch { /* ignore */ }
  _db = null;
  _initPromise = null;
  _dirty = false;
}

// ── internal helpers ──

function _startPeriodicSave() {
  // Save every 30 seconds as a safety net
  _periodicTimer = setInterval(() => {
    if (_dirty) saveDb();
  }, 30_000);
}

function _setupShutdownHooks() {
  const shutdown = (signal: string) => {
    console.log(`[DB] ${signal} received, flushing...`);
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Save on uncaught errors (best-effort)
  process.on('uncaughtException', (err) => {
    console.error('[DB] Uncaught exception, attempting save:', err.message);
    saveDb();
    process.exit(1);
  });
}

function runMigrations(db: SqlJsDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      google_id TEXT UNIQUE,
      plan TEXT DEFAULT 'trial',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  // Ensure default user exists (required for FK constraints)
  db.run(`INSERT OR IGNORE INTO users (id, email, name, plan) VALUES ('default', 'default@local', '默认用户', 'trial')`);
  db.run(`
    CREATE TABLE IF NOT EXISTS tool_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      tool_id TEXT NOT NULL,
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      email TEXT,
      name TEXT,
      phone TEXT DEFAULT '',
      wechat_id TEXT DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'inquiry',
      type TEXT DEFAULT '',
      shoot_date TEXT,
      package_type TEXT,
      source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '',
      pixieset_gallery_id TEXT,
      stripe_customer_id TEXT,
      metadata TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      client_id TEXT REFERENCES clients(id),
      from_address TEXT,
      subject TEXT,
      body TEXT,
      category TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      ai_reply TEXT,
      channel TEXT DEFAULT 'email',
      thread_id TEXT,
      stage_at_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      client_id TEXT REFERENCES clients(id),
      client_name TEXT,
      client_email TEXT,
      amount REAL,
      currency TEXT DEFAULT 'USD',
      description TEXT,
      items TEXT DEFAULT '[]',
      payment_schedule TEXT DEFAULT 'single',
      retainer_type TEXT,
      status TEXT DEFAULT 'draft',
      stripe_payment_link TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      client_id TEXT REFERENCES clients(id),
      title TEXT NOT NULL,
      packages TEXT DEFAULT '[]',
      pricing TEXT DEFAULT '{}',
      contract_terms TEXT DEFAULT '',
      share_token TEXT UNIQUE,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migrate existing tables (add columns if missing)
  const addCol = (table: string, col: string, type: string) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (_) { /* already exists */ }
  };
  addCol('clients', 'phone', "TEXT DEFAULT ''");
  addCol('clients', 'wechat_id', "TEXT DEFAULT ''");
  addCol('clients', 'source', "TEXT DEFAULT 'manual'");
  addCol('clients', 'notes', "TEXT DEFAULT ''");
  addCol('clients', 'type', "TEXT DEFAULT ''");
  addCol('clients', 'status', "TEXT DEFAULT 'active'");
  addCol('messages', 'channel', "TEXT DEFAULT 'email'");
  addCol('messages', 'thread_id', "TEXT DEFAULT NULL");
  addCol('users', 'password_hash', 'TEXT');

  // Add UNIQUE constraint on tool_connections (safe: ALTER TABLE ADD CONSTRAINT fails silently if exists)
  try { db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_user_tool ON tool_connections(user_id, tool_id)'); } catch (_) { }

  // Initial save after migrations
  const data = db.export();
  fs.writeFileSync(DB_PATH, data);
}
