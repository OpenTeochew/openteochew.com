import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { searchEntries } from './search'

type Row = Record<string, any>

function like(value: string | null | undefined, pattern: string) {
  if (!value) return false
  const normalizedValue = ` ${value.toLowerCase().replace(/[,.;:!?()\/"']/g, ' ')} `
  const normalizedPattern = pattern.replaceAll('\\', '').toLowerCase()
  const needle = normalizedPattern.replaceAll('%', '').trim()
  if (normalizedPattern.startsWith('%') && normalizedPattern.endsWith('%')) return normalizedValue.includes(` ${needle} `)
  if (normalizedPattern.startsWith('%')) return normalizedValue.endsWith(` ${needle}`)
  if (normalizedPattern.endsWith('%')) return normalizedValue.startsWith(`${needle} `)
  return normalizedValue.trim() === needle
}

function sourceRow(id: number) {
  return {
    source_name: `source ${id}`,
    source_name_zh: `來源 ${id}`,
    source_year: '2026',
    source_original_fields: null,
    section_title: null,
  }
}

function createEntry(row: Partial<Row>): Row {
  return {
    id: row.id,
    han: row.han ?? null,
    puj: row.puj ?? null,
    dp: row.dp ?? null,
    en: row.en ?? null,
    mandarin: row.mandarin ?? null,
    ja: row.ja ?? null,
    han_orig: row.han_orig ?? null,
    puj_orig: row.puj_orig ?? null,
    en_orig: row.en_orig ?? null,
    page_num: row.page_num ?? null,
    source_id: row.source_id ?? 1,
    sort_order: row.sort_order ?? row.id ?? 0,
    latn_norm: row.latn_norm ?? null,
    ...sourceRow(row.source_id ?? 1),
  }
}

function createFakeDb(entries: Row[], dict: Row[] = []) {
  const queries: string[] = []

  function filteredEntries(sql: string, values: any[]) {
    const sourceFilter = sql.includes('AND e.source_id = ?') ? [...values].reverse().find((value) => typeof value === 'number') : undefined
    const searchTerms = values.filter((value) => typeof value === 'string')
    const englishMode = sql.includes('e.en LIKE ?') || sql.includes('e.en_orig LIKE ?') || sql.includes("COALESCE(e.en") || sql.includes("COALESCE(e.en_orig")
    const mandarinMode = sql.includes('e.mandarin LIKE ?')

    return entries.filter((entry) => {
      if (sourceFilter && entry.source_id !== sourceFilter) return false
      if (englishMode) {
        const englishTerms = searchTerms.filter((term) => !term.includes('没有') && !term.includes('沒有'))
        return englishTerms.some((term) => like(entry.en, term) || like(entry.en_orig, term))
      }
      if (mandarinMode) {
        return searchTerms.some((term) => like(entry.mandarin, term))
      }
      return false
    })
  }

  return {
    queries,
    prepare(sql: string) {
      queries.push(sql)
      return {
        bind(...values: any[]) {
          return {
            async first<T>() {
              if (sql.includes('COUNT(*) as total')) {
                return { total: filteredEntries(sql, values).length } as T
              }
              return null as T
            },
            async all() {
              if (sql.includes('FROM zh_en_dict')) {
                const terms = values.map((value) => String(value).replaceAll('%', ''))
                const rows = dict
                  .filter((row) => terms.some((term) => row.zh_tw.includes(term)))
                  .sort((a, b) => {
                    const lowerRankA = a.en === String(a.en).toLowerCase() ? 0 : 1
                    const lowerRankB = b.en === String(b.en).toLowerCase() ? 0 : 1
                    return lowerRankA - lowerRankB || String(a.en).length - String(b.en).length || a.zh_tw.length - b.zh_tw.length
                  })
                return { results: rows }
              }

              if (sql.includes('GROUP BY e.source_id')) {
                const counts = new Map<number, number>()
                for (const entry of filteredEntries(sql, values)) {
                  counts.set(entry.source_id, (counts.get(entry.source_id) ?? 0) + 1)
                }
                return { results: [...counts].map(([source_id, total]) => ({ source_id, total })) }
              }

              return { results: filteredEntries(sql, values) }
            },
          }
        },
      }
    },
  } as unknown as D1Database & { queries: string[] }
}

const baseParams = { page: 1, limit: 10 }

describe('searchEntries Mandarin bridge search', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  test('returns direct Mandarin matches without querying the bridge dictionary', async () => {
    const db = createFakeDb([
      createEntry({ id: 1, han: '電腦', mandarin: '電腦', en: 'computer' }),
    ])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '電腦' })

    expect(result.total).toBe(1)
    expect(result.match_meta).toEqual({ mode: 'direct' })
    expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
      event: 'direct_result',
      input: '電腦',
      traditional: '電腦',
      directTotal: 1,
    })
    expect(db.queries.some((sql) => sql.includes('FROM zh_en_dict'))).toBe(false)
  })

  test('bridges simplified Mandarin through traditional dictionary terms', async () => {
    const db = createFakeDb([
      createEntry({ id: 1, han: '電腦', mandarin: null, en: 'computer' }),
    ], [
      { id: 1, zh_tw: '電腦', en: 'computer', pos: 'n.' },
    ])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '电脑' })

    expect(result.total).toBe(1)
    expect(result.groups[0].entries[0].en).toBe('computer')
    expect(result.match_meta).toEqual({ mode: 'mandarin_bridge', bridge_terms: ['computer'] })
    expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
      event: 'bridge_terms',
      input: '电脑',
      traditional: '電腦',
      bridgeTerms: ['computer'],
    })
    expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
      event: 'bridge_result',
      input: '电脑',
      traditional: '電腦',
      bridgeTerms: ['computer'],
      bridgeTotal: 1,
    })
  })

  test('uses at most five unique English bridge candidates', async () => {
    const db = createFakeDb([], [
      { id: 1, zh_tw: '測試一', en: 'one', pos: 'n.' },
      { id: 2, zh_tw: '測試二', en: 'two', pos: 'n.' },
      { id: 3, zh_tw: '測試三', en: 'three', pos: 'n.' },
      { id: 4, zh_tw: '測試四', en: 'four', pos: 'n.' },
      { id: 5, zh_tw: '測試五', en: 'five', pos: 'n.' },
      { id: 6, zh_tw: '測試六', en: 'six', pos: 'n.' },
      { id: 7, zh_tw: '測試七', en: 'one', pos: 'n.' },
    ])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '測試' })

    expect(result.match_meta).toEqual({
      mode: 'mandarin_bridge',
      bridge_terms: ['one', 'two', 'six', 'four', 'five'],
    })
  })

  test('prioritizes lowercase and shorter bridge candidates', async () => {
    const db = createFakeDb([
      createEntry({ id: 1, han: '日', en: 'Sun.' }),
      createEntry({ id: 2, han: '阿波羅', en: 'Apollo' }),
      createEntry({ id: 3, han: '日頭', en: 'Dry, in the sun' }),
    ], [
      { id: 1, zh_tw: '太陽', en: 'Apollo', pos: 'n.' },
      { id: 2, zh_tw: '太陽', en: 'daystar', pos: 'n.' },
      { id: 3, zh_tw: '太陽', en: 'Sol', pos: 'n.' },
      { id: 4, zh_tw: '太陽', en: 'sun', pos: 'n.' },
    ])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '太阳' })

    expect(result.match_meta?.bridge_terms[0]).toBe('sun')
    expect(result.groups[0].entries[0].en).toBe('Sun.')
  })

  test('does not match short bridge terms inside unrelated English words', async () => {
    const db = createFakeDb([
      createEntry({ id: 1, han: '烏', en: 'Black' }),
      createEntry({ id: 2, han: '欠', en: 'Want, lack' }),
    ], [
      { id: 1, zh_tw: '沒有', en: 'lack', pos: 'n.' },
    ])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '没有' })

    expect(result.total).toBe(1)
    expect(result.groups[0].entries).toHaveLength(1)
    expect(result.groups[0].entries[0].en).toBe('Want, lack')
  })

  test('returns empty bridge result when no dictionary candidates exist', async () => {
    const db = createFakeDb([])

    const result = await searchEntries(db, { ...baseParams, q_mandarin: '不存在' })

    expect(result).toEqual({
      total: 0,
      page: 1,
      groups: [],
      match_meta: { mode: 'mandarin_bridge', bridge_terms: [] },
    })
    expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
      event: 'bridge_terms',
      input: '不存在',
      traditional: '不存在',
      bridgeTerms: [],
    })
  })
})
