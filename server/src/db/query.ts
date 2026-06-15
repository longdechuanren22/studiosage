import { getDb, markDirty } from './schema.js';

/** Read multiple rows */
export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params as any);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

/** Read single row */
export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params as any);
  let result: T | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as unknown as T;
  }
  stmt.free();
  return result;
}

/** Execute a write statement (INSERT/UPDATE/DELETE). Auto-marks dirty for save. */
export function run(sql: string, params: unknown[] = []): void {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params as any);
  stmt.step();
  stmt.free();
  markDirty();
}

/** Execute multiple write statements in sequence, with explicit dirty markers */
export function runAll(statements: Array<{ sql: string; params?: unknown[] }>): void {
  const db = getDb();
  for (const s of statements) {
    const stmt = db.prepare(s.sql);
    if (s.params && s.params.length > 0) stmt.bind(s.params as any);
    stmt.step();
    stmt.free();
  }
  markDirty();
}
