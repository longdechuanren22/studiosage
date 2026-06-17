export declare function queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
export declare function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
export declare function run(sql: string, params?: unknown[]): void;
