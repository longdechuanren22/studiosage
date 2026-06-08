import { getDb } from './schema.js';
// Simple prepared-statement style wrapper over sql.js
export function queryAll(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length > 0)
        stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}
export function queryOne(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length > 0)
        stmt.bind(params);
    let result;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    return result;
}
export function run(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length > 0)
        stmt.bind(params);
    stmt.step();
    stmt.free();
}
