// Query helpers — better-sqlite3 (synchronous, crash-safe)
import { getDb, backupDb } from './schema.js';

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return (getDb().prepare(sql).all(...params) || []) as T[];
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  return (getDb().prepare(sql).get(...params) || null) as T | null;
}

export function run(sql: string, params: unknown[] = []): void {
  getDb().prepare(sql).run(...params);
  backupDb();
}
