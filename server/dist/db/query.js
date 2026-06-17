// Query helpers — better-sqlite3 (synchronous, crash-safe)
import { getDb, backupDb } from './schema.js';
export function queryAll(sql, params = []) {
    return (getDb().prepare(sql).all(...params) || []);
}
export function queryOne(sql, params = []) {
    return (getDb().prepare(sql).get(...params) || null);
}
export function run(sql, params = []) {
    getDb().prepare(sql).run(...params);
    backupDb();
}
