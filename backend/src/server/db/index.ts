export async function query<T>(
  db: D1Database,
  sql: string,
  params?: any[]
): Promise<T[]> {
  const stmt = db.prepare(sql)
  const result = params ? await stmt.bind(...params).all() : await stmt.all()
  return result.results as T[]
}

export async function queryOne<T>(
  db: D1Database,
  sql: string,
  params?: any[]
): Promise<T | null> {
  const results = await query<T>(db, sql, params)
  return results[0] || null
}
