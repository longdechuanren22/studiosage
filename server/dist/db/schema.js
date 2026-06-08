import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
const DB_PATH = path.join(process.cwd(), 'data', 'studiosage.db');
let _db = null;
let _ready = null;
export async function initDb() {
    if (_db)
        return _db;
    if (_ready)
        return _ready;
    _ready = (async () => {
        const SQL = await initSqlJs();
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        if (fs.existsSync(DB_PATH)) {
            const buffer = fs.readFileSync(DB_PATH);
            _db = new SQL.Database(buffer);
        }
        else {
            _db = new SQL.Database();
        }
        _db.run('PRAGMA foreign_keys = ON');
        runMigrations(_db);
        return _db;
    })();
    return _ready;
}
export function getDb() {
    if (!_db)
        throw new Error('Database not initialized. Call initDb() first.');
    return _db;
}
export function saveDb() {
    if (!_db)
        return;
    const data = _db.export();
    fs.writeFileSync(DB_PATH, data);
}
function runMigrations(db) {
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
      stage TEXT NOT NULL DEFAULT 'inquiry',
      shoot_date TEXT,
      package_type TEXT,
      pixieset_gallery_id TEXT,
      stripe_customer_id TEXT,
      metadata TEXT DEFAULT '{}',
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
    saveDb();
}
