import Database from 'better-sqlite3';
export declare function initDb(): Promise<Database.Database>;
export declare function getDb(): Database.Database;
export declare function isDbReady(): boolean;
export declare function backupDb(): void;
export declare function closeDb(): void;
