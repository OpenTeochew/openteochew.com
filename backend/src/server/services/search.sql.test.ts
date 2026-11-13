import { afterEach, describe, expect, test } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { searchEntries } from './search'

const databases: DatabaseSync[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function createSqliteDb() {
  const sqlite = new DatabaseSync(':memory:')
  databases.push(sqlite)
  sqlite.exec(`
    CREATE TABLE sources (
      id INTEGER PRIMARY KEY, name TEXT, name_zh TEXT, year TEXT, original_fields TEXT
    );
    CREATE TABLE sections (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE entries (
      id INTEGER PRIMARY KEY, source_id INTEGER, section_id INTEGER,
      han TEXT, puj TEXT, dp TEXT, en TEXT, mandarin TEXT, ja TEXT,
      han_orig TEXT, puj_orig TEXT, en_orig TEXT, page_num INTEGER,
      sort_order INTEGER, latn_norm TEXT
    );
    INSERT INTO sources (id, name) VALUES (1, 'one'), (2, 'two'), (3, 'three');
  `)

  return {
    sqlite,
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async all() {
                return { results: sqlite.prepare(sql).all(...values) }
              },
              async first() {
                return sqlite.prepare(sql).get(...values) ?? null
              },
            }
          },
        }
      },
    } as unknown as D1Database,
  }
}

describe('searchEntries SQLite query behavior', () => {
  test('returns every source page once with accurate group and overall counts', async () => {
    const { sqlite, db } = createSqliteDb()
    const insert = sqlite.prepare(
      'INSERT INTO entries (id, source_id, han, sort_order) VALUES (?, ?, ?, ?)'
    )

    for (let sourceId = 1; sourceId <= 3; sourceId++) {
      for (let index = 0; index < 25; index++) {
        insert.run(sourceId * 100 + index, sourceId, '時', index)
      }
    }

    const firstPage = await searchEntries(db, { q_han: '時', page: 1, limit: 20 })
    const secondPage = await searchEntries(db, { q_han: '時', source_id: 1, page: 2, limit: 20 })

    expect(firstPage.total).toBe(75)
    expect(firstPage.groups.map((group) => [group.source.id, group.count, group.entries.length])).toEqual([
      [1, 25, 20], [2, 25, 20], [3, 25, 20],
    ])
    expect(secondPage.total).toBe(25)
    expect(secondPage.groups).toHaveLength(1)
    expect(secondPage.groups[0].entries.map((entry) => entry.id)).toEqual([120, 121, 122, 123, 124])
  })

  test('supports source-only queries with stable ordering', async () => {
    const { sqlite, db } = createSqliteDb()
    sqlite.exec("INSERT INTO entries (id, source_id, han, sort_order) VALUES (2, 1, '乙', 2), (1, 1, '甲', 1)")

    const result = await searchEntries(db, { source_id: 1, page: 1, limit: 20 })

    expect(result.total).toBe(2)
    expect(result.groups[0].entries.map((entry) => entry.id)).toEqual([1, 2])
  })

  test('preserves PUJ exact, prefix, and substring ranking within a source', async () => {
    const { sqlite, db } = createSqliteDb()
    const insert = sqlite.prepare(
      'INSERT INTO entries (id, source_id, puj, latn_norm, sort_order) VALUES (?, 1, ?, ?, ?)'
    )
    insert.run(1, 'xxsi5xx', 'xxsi5xx', 1)
    insert.run(2, 'si5x', 'si5x', 0)
    insert.run(3, 'si5', 'si5', 10)
    insert.run(4, 'si5', 'si5', 1)

    const result = await searchEntries(db, {
      q_puj: 'si5', source_id: 1, page: 1, limit: 20,
    })

    expect(result.total).toBe(4)
    expect(result.groups[0].entries.map((entry) => entry.id)).toEqual([4, 3, 2, 1])
  })

  test('keeps SQL relevance order when searching within one source', async () => {
    const { sqlite, db } = createSqliteDb()
    const insert = sqlite.prepare(
      'INSERT INTO entries (id, source_id, en, sort_order) VALUES (?, 1, ?, ?)'
    )
    insert.run(1, 'man', 20)
    insert.run(2, 'man', 10)
    insert.run(3, 'a man', 1)
    insert.run(4, 'human', 0)

    const result = await searchEntries(db, {
      q_en: 'man', source_id: 1, page: 1, limit: 20,
    })

    expect(result.total).toBe(3)
    expect(result.groups[0].entries.map((entry) => entry.id)).toEqual([2, 1, 3])
  })
})
