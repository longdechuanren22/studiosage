import { Database as SqlJsDatabase } from 'sql.js';
export declare function initDb(): Promise<SqlJsDatabase>;
export declare function getDb(): SqlJsDatabase;
export declare function saveDb(): void;
