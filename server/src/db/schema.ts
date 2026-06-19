// Database layer — better-sqlite3 (persistent, crash-safe)
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'data', 'studiosage.db');
const DB_BAK_PATH = path.join(process.cwd(), 'data', 'studiosage.db.bak');

let _db: Database.Database | null = null;
let _initPromise: Promise<Database.Database> | null = null;

export async function initDb(): Promise<Database.Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    // Crash recovery: try main DB, then backup, then fresh
    if (fs.existsSync(DB_PATH)) {
      try {
        _db = new Database(DB_PATH);
        _db.pragma('journal_mode = WAL');
        _db.pragma('foreign_keys = ON');
      } catch {
        console.error('[DB] Primary DB corrupted, trying backup...');
        try {
          fs.copyFileSync(DB_BAK_PATH, DB_PATH);
          _db = new Database(DB_PATH);
          _db.pragma('journal_mode = WAL');
          _db.pragma('foreign_keys = ON');
          console.log('[DB] Restored from backup');
        } catch {
          _db = new Database(DB_PATH);
          _db.pragma('journal_mode = WAL');
          _db.pragma('foreign_keys = ON');
        }
      }
    } else {
      _db = new Database(DB_PATH);
      _db.pragma('journal_mode = WAL');
      _db.pragma('foreign_keys = ON');
    }

    runMigrations(_db);
    _setupShutdownHooks();
    return _db;
  })();

  return _initPromise;
}

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized');
  return _db;
}

export function isDbReady(): boolean { return _db !== null; }

// Backup before each write (lightweight: just copy the WAL-backed file)
export function backupDb() {
  if (!_db) return;
  try { fs.copyFileSync(DB_PATH, DB_BAK_PATH); } catch {}
}

export function closeDb() {
  try { _db?.close(); } catch {}
  _db = null;
  _initPromise = null;
}

// ── Migrations ──

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, google_id TEXT UNIQUE,
      plan TEXT DEFAULT 'trial', password_hash TEXT,
      stripe_customer_id TEXT, stripe_subscription_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO users (id, email, name, plan) VALUES ('default', 'default@local', 'Default', 'trial');

    CREATE TABLE IF NOT EXISTS tool_connections (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), tool_id TEXT NOT NULL,
      access_token_encrypted TEXT, refresh_token_encrypted TEXT, expires_at TEXT,
      status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), email TEXT, name TEXT,
      phone TEXT DEFAULT '', wechat_id TEXT DEFAULT '', stage TEXT NOT NULL DEFAULT 'inquiry',
      type TEXT DEFAULT '', shoot_date TEXT, package_type TEXT, source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '', stripe_customer_id TEXT,
      metadata TEXT DEFAULT '{}', conversation_memory TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active', updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), client_id TEXT REFERENCES clients(id),
      from_address TEXT, subject TEXT, body TEXT, category TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending', ai_reply TEXT, channel TEXT DEFAULT 'email',
      thread_id TEXT, stage_at_time TEXT, imap_uid TEXT, created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), client_id TEXT REFERENCES clients(id),
      client_name TEXT, client_email TEXT, amount REAL, currency TEXT DEFAULT 'USD',
      description TEXT, items TEXT DEFAULT '[]', payment_schedule TEXT DEFAULT 'single',
      retainer_type TEXT, status TEXT DEFAULT 'draft', stripe_payment_link TEXT, created_at TEXT DEFAULT (datetime('now'))
    );

    -- ── 选片→修图协作→交付 模块 ──

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), client_id TEXT REFERENCES clients(id),
      title TEXT NOT NULL, shoot_type TEXT DEFAULT 'wedding',
      shoot_date TEXT, delivery_due_date TEXT,
      package_type TEXT DEFAULT 'Standard',
      max_retouch_count INTEGER DEFAULT 30,
      max_revision_rounds INTEGER DEFAULT 2,
      current_round INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      proposal_id TEXT, metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_galleries (
      id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), user_id TEXT REFERENCES users(id),
      total_count INTEGER DEFAULT 0,
      photos TEXT DEFAULT '[]',
      selection_deadline TEXT,
      selection_status TEXT DEFAULT 'uploading',
      selected_ids TEXT DEFAULT '[]', rejected_ids TEXT DEFAULT '[]', favorite_ids TEXT DEFAULT '[]',
      share_token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_rounds (
      id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), user_id TEXT REFERENCES users(id),
      round_number INTEGER NOT NULL,
      delivered_photos TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending_review',
      review_deadline TEXT, share_token TEXT UNIQUE,
      client_feedback TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revision_requests (
      id TEXT PRIMARY KEY, round_id TEXT REFERENCES delivery_rounds(id), user_id TEXT REFERENCES users(id),
      photo_id TEXT NOT NULL,
      revision_type TEXT DEFAULT 'other',
      description TEXT DEFAULT '',
      annotation TEXT DEFAULT NULL,
      status TEXT DEFAULT 'pending',
      photographer_note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add columns that may be missing on older DBs
  const addCol = (table: string, col: string, type: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  };
  addCol('clients', 'phone', "TEXT DEFAULT ''");
  addCol('clients', 'wechat_id', "TEXT DEFAULT ''");
  addCol('clients', 'source', "TEXT DEFAULT 'manual'");
  addCol('clients', 'notes', "TEXT DEFAULT ''");
  addCol('clients', 'type', "TEXT DEFAULT ''");
  addCol('clients', 'status', "TEXT DEFAULT 'active'");
  addCol('messages', 'channel', "TEXT DEFAULT 'email'");
  addCol('messages', 'thread_id', "TEXT DEFAULT NULL");
  addCol('messages', 'imap_uid', 'TEXT');
  addCol('users', 'password_hash', 'TEXT');
  addCol('users', 'stripe_customer_id', 'TEXT');
  addCol('users', 'stripe_subscription_id', 'TEXT');
  addCol('delivery_rounds', 'share_token', 'TEXT');
  addCol('clients', 'conversation_memory', "TEXT DEFAULT '{}'");

  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_user_tool ON tool_connections(user_id, tool_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_imap_uid ON messages(user_id, imap_uid)'); } catch {}

  // Project indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)'); } catch {}
  // Gallery indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_galleries_project ON project_galleries(project_id)'); } catch {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_galleries_share_token ON project_galleries(share_token)'); } catch {}
  // Delivery round indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_delivery_rounds_project ON delivery_rounds(project_id)'); } catch {}
  // Revision request indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_revision_requests_round ON revision_requests(round_id)'); } catch {}
  // Delivery round share token index
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_share_token ON delivery_rounds(share_token)'); } catch {}

  backupDb();
}

function _setupShutdownHooks() {
  const shutdown = () => { backupDb(); closeDb(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
