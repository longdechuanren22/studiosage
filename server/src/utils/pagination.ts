/** Pagination helper — cursor-based using created_at */

interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Execute a paginated query.
 * @param queryAll — the queryAll function
 * @param baseSql — SQL with WHERE clauses, must have `WHERE ... ORDER BY created_at DESC`
 * @param baseParams — parameters for the WHERE clauses
 * @param cursor — optional cursor (created_at value from last item of previous page)
 * @param limit — page size (default 20)
 */
export function paginate<T>(
  queryAllFn: (sql: string, params: unknown[]) => T[],
  baseSql: string,
  baseParams: unknown[],
  cursor?: string,
  limit = 20,
): PaginatedResult<T> {
  // Add cursor condition
  let sql = baseSql;
  const params = [...baseParams];

  if (cursor) {
    // Assume baseSql ends with ORDER BY created_at DESC (or similar)
    // Insert cursor WHERE before ORDER BY
    if (sql.includes('ORDER BY')) {
      sql = sql.replace(/ORDER BY/, 'AND created_at < ? ORDER BY');
    } else {
      sql += ' AND created_at < ?';
    }
    params.push(cursor);
  }

  // Fetch one extra to determine hasMore
  sql += ' LIMIT ?';
  params.push(limit + 1);

  const rows = queryAllFn(sql, params);
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const nextCursor = hasMore && rows.length > 0
    ? (rows[rows.length - 1] as any).created_at
    : null;

  return { data: rows, nextCursor, hasMore };
}
