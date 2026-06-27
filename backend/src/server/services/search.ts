import OpenCC from 'opencc-js'
import { normalizeToLatnNorm } from './normalize'

const s2t = OpenCC.Converter({ from: 'cn', to: 'tw' })

type SearchParams = {
  q_han?: string
  q_puj?: string
  q_dp?: string
  q_en?: string
  q_en_terms?: string[]
  q_mandarin?: string
  q_ja?: string
  source_id?: number
  page: number
  limit: number
}

function toTraditional(s?: string): string | undefined {
  return s ? s2t(s) : s
}

function uniqueTerms(...terms: Array<string | undefined>): string[] {
  return [...new Set(terms.filter((term): term is string => Boolean(term)))]
}

function escSql(s: string) {
  return s.replace(/'/g, "''")
}

function escLike(s: string) {
  return s.replace(/[%_\\']/g, '\\$&')
}

function englishWordExpression(field: string): string {
  return `LOWER(' ' || REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${field}, ''), ',', ' '), '.', ' '), ';', ' '), ':', ' '), '!', ' '), '?', ' '), '(', ' '), ')', ' '), '/', ' '), '"', ' ') || ' ')`
}

function bridgeEnglishTermWhere(term: string, values: any[]): string {
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(term)) {
    values.push(`%${term}%`, `%${term}%`)
    return '(e.en LIKE ? OR e.en_orig LIKE ?)'
  }

  values.push(`% ${term.toLowerCase()} %`, `% ${term.toLowerCase()} %`)
  return `(${englishWordExpression('e.en')} LIKE ? OR ${englishWordExpression('e.en_orig')} LIKE ?)`
}

function logMandarinBridge(data: Record<string, unknown>) {
  console.info('[search:mandarin_bridge]', data)
}

async function findMandarinBridgeTerms(db: D1Database, terms: string[], limit = 5): Promise<string[]> {
  if (terms.length === 0) return []

  const conditions: string[] = []
  const values: string[] = []
  for (const term of terms) {
    conditions.push('zh_tw LIKE ?')
    values.push(`%${term}%`)
  }

  const exactCases = terms.map((term) => `WHEN zh_tw = '${escSql(term)}' THEN 0`).join(' ')
  const prefixCases = terms.map((term) => `WHEN zh_tw LIKE '${escLike(term)}%' ESCAPE '\\' THEN 1`).join(' ')
  const rows = await db.prepare(
    `SELECT en FROM zh_en_dict WHERE ${conditions.join(' OR ')} ORDER BY CASE ${exactCases} ${prefixCases} ELSE 2 END, CASE WHEN en = LOWER(en) THEN 0 ELSE 1 END, LENGTH(en), LENGTH(zh_tw) LIMIT 50`
  ).bind(...values).all()

  const result: string[] = []
  for (const row of rows.results as Array<{ en?: string }>) {
    const en = row.en?.trim()
    if (en && !result.includes(en)) result.push(en)
    if (result.length >= limit) break
  }
  return result
}

async function runSearchEntries(
  db: D1Database,
  params: SearchParams,
  matchMeta?: { mode: 'direct' | 'mandarin_bridge'; bridge_terms?: string[] }
) {
  const origHan = params.q_han
  const origMandarin = params.q_mandarin
  const q_han = toTraditional(params.q_han)
  const q_mandarin = toTraditional(params.q_mandarin)

  const conditions: string[] = []
  const values: any[] = []

  if (q_han) {
    if (origHan !== q_han) {
      conditions.push('(e.han LIKE ? OR e.han LIKE ? OR e.han_orig LIKE ? OR e.han_orig LIKE ?)')
      values.push(`%${origHan}%`, `%${q_han}%`, `%${origHan}%`, `%${q_han}%`)
    } else {
      conditions.push('(e.han LIKE ? OR e.han_orig LIKE ?)')
      values.push(`%${q_han}%`, `%${q_han}%`)
    }
  }
  if (params.q_puj) {
    const candidates = normalizeToLatnNorm(params.q_puj, 'puj')
    const latnConds = candidates.map(() => 'e.latn_norm LIKE ?')
    const latnVals = candidates.map((c) => `%${c}%`)
    conditions.push(`(${latnConds.join(' OR ')} OR e.puj LIKE ? OR e.puj_orig LIKE ?)`) 
    values.push(...latnVals, `%${params.q_puj}%`, `%${params.q_puj}%`)
  }
  if (params.q_dp) {
    const candidates = normalizeToLatnNorm(params.q_dp, 'dp')
    const latnConds = candidates.map(() => 'e.latn_norm LIKE ?')
    const latnVals = candidates.map((c) => `%${c}%`)
    conditions.push(`(${latnConds.join(' OR ')} OR e.dp LIKE ?)`) 
    values.push(...latnVals, `%${params.q_dp}%`)
  }
  const qEnTerms = params.q_en_terms?.length ? params.q_en_terms : params.q_en ? [params.q_en] : []
  if (qEnTerms.length > 0) {
    conditions.push(`(${qEnTerms.map((term) => bridgeEnglishTermWhere(term, values)).join(' OR ')})`)
  }
  if (q_mandarin) {
    if (origMandarin !== q_mandarin) {
      conditions.push('(e.mandarin LIKE ? OR e.mandarin LIKE ?)')
      values.push(`%${origMandarin}%`, `%${q_mandarin}%`)
    } else {
      conditions.push('e.mandarin LIKE ?')
      values.push(`%${q_mandarin}%`)
    }
  }
  if (params.q_ja) { conditions.push('e.ja LIKE ?'); values.push(`%${params.q_ja}%`) }
  if (params.source_id) { conditions.push('e.source_id = ?'); values.push(params.source_id) }

  if (conditions.length === 0) {
    return { total: 0, page: params.page, groups: [], ...(matchMeta ? { match_meta: matchMeta } : {}) }
  }

  const where = conditions.join(' AND ')

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM entries e WHERE ${where}`
  ).bind(...values).first<{ total: number }>()

  const sourceCounts = await db.prepare(
    `SELECT e.source_id, COUNT(*) as total FROM entries e WHERE ${where} GROUP BY e.source_id`
  ).bind(...values).all()
  const sourceTotalMap = new Map<number, number>()
  for (const row of sourceCounts.results as any[]) {
    sourceTotalMap.set(row.source_id, row.total)
  }
  function escLikeOrder(s: string) {
    return s.replace(/[%_\\]/g, '\\$&')
  }

  const primaryField = (q_han && 'e.han')
    || (params.q_puj && 'e.latn_norm')
    || (params.q_dp && 'e.latn_norm')
    || (qEnTerms.length > 0 && 'e.en')
    || (q_mandarin && 'e.mandarin')
    || (params.q_ja && 'e.ja')
    || null

  const latnCandidates = params.q_puj
    ? normalizeToLatnNorm(params.q_puj, 'puj')
    : params.q_dp
      ? normalizeToLatnNorm(params.q_dp, 'dp')
      : []

  const latnRawField = params.q_puj ? 'e.puj' : params.q_dp ? 'e.dp' : null
  const latnRawInput = params.q_puj ?? params.q_dp ?? ''

  let tierExpr = '0'
  if (latnCandidates.length > 0 && latnRawField) {
    const parts: string[] = []
    for (const c of latnCandidates) {
      parts.push(`e.latn_norm = '${escLike(c)}'`)
    }
    const exact = parts.join(' OR ')

    const prefixParts = latnCandidates.map((c) => `e.latn_norm LIKE '${escLike(c)}%' ESCAPE '\\'`)
    const prefix = prefixParts.join(' OR ')

    const subParts = latnCandidates.map((c) => `e.latn_norm LIKE '%${escLike(c)}%' ESCAPE '\\'`)
    const sub = subParts.join(' OR ')

    tierExpr = `CASE WHEN ${exact} THEN 0 WHEN ${prefix} THEN 1 WHEN ${sub} THEN 2 WHEN ${latnRawField} LIKE '%${escLike(latnRawInput)}%' ESCAPE '\\' THEN 3 ELSE 4 END`
  }

  const boostParts: string[] = []
  if (tierExpr !== '0') {
    boostParts.push(tierExpr)
  } else if (qEnTerms.length > 0) {
    const cases = qEnTerms.map((term, index) => {
      const word = `% ${escLike(term.toLowerCase())} %`
      return `WHEN ${englishWordExpression('e.en')} LIKE '${word}' ESCAPE '\\' OR ${englishWordExpression('e.en_orig')} LIKE '${word}' ESCAPE '\\' THEN ${index}`
    }).join(' ')
    const exactCases = qEnTerms.map((term, index) => {
      const word = escSql(term.toLowerCase())
      return `WHEN LOWER(TRIM(REPLACE(COALESCE(e.en, ''), '.', ''))) = '${word}' OR LOWER(TRIM(REPLACE(COALESCE(e.en_orig, ''), '.', ''))) = '${word}' THEN ${index}`
    }).join(' ')
    boostParts.push(`CASE ${exactCases} ELSE ${qEnTerms.length} END`)
    boostParts.push(`CASE ${cases} ELSE ${qEnTerms.length} END`)
  } else if (origHan && origHan !== q_han && primaryField) {
    boostParts.push(`CASE WHEN ${primaryField} LIKE '%${escLikeOrder(origHan)}%' ESCAPE '\\' THEN 0 ELSE 1 END`)
  }
  if (primaryField) boostParts.push(`LENGTH(COALESCE(${primaryField}, ''))`)
  const relevanceOrder = boostParts.length > 0 ? boostParts.join(', ') : '0'

  const offset = (params.page - 1) * params.limit
  let entries
  if (params.source_id) {
    entries = await db.prepare(
      `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, s.original_fields as source_original_fields, sec.title as section_title
       FROM entries e
       JOIN sources s ON e.source_id = s.id
       LEFT JOIN sections sec ON e.section_id = sec.id
       WHERE ${where}
       ORDER BY ${relevanceOrder}, e.source_id, e.sort_order
       LIMIT ? OFFSET ?`
    ).bind(...values, params.limit, offset).all()
  } else {
    const allEntries: any[] = []
    for (const sourceId of sourceTotalMap.keys()) {
      const sourceValues = [...values, sourceId]
      const rows = await db.prepare(
        `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, s.original_fields as source_original_fields, sec.title as section_title
         FROM entries e
         JOIN sources s ON e.source_id = s.id
         LEFT JOIN sections sec ON e.section_id = sec.id
         WHERE ${where} AND e.source_id = ?
         ORDER BY ${relevanceOrder}, e.sort_order
         LIMIT ? OFFSET ?`
      ).bind(...sourceValues, params.limit, offset).all()
      allEntries.push(...(rows.results as any[]))
    }
    allEntries.sort((a, b) => {
      if (qEnTerms.length > 0) {
        const exactTermRank = (entry: any) => qEnTerms.findIndex((term) => {
          const normalized = term.toLowerCase()
          const en = String(entry.en || '').toLowerCase().replace(/[.]/g, '').trim()
          const enOrig = String(entry.en_orig || '').toLowerCase().replace(/[.]/g, '').trim()
          return en === normalized || enOrig === normalized
        })
        const aiExact = exactTermRank(a)
        const biExact = exactTermRank(b)
        const arExact = aiExact === -1 ? qEnTerms.length : aiExact
        const brExact = biExact === -1 ? qEnTerms.length : biExact
        if (arExact !== brExact) return arExact - brExact

        const wordRank = (entry: any) => qEnTerms.findIndex((term) => {
          const normalized = ` ${term.toLowerCase()} `
          const en = ` ${String(entry.en || '').toLowerCase().replace(/[,.;:!?()\/\"]/g, ' ')} `
          const enOrig = ` ${String(entry.en_orig || '').toLowerCase().replace(/[,.;:!?()\/\"]/g, ' ')} `
          return en.includes(normalized) || enOrig.includes(normalized)
        })
        const ai = wordRank(a)
        const bi = wordRank(b)
        const ar = ai === -1 ? qEnTerms.length : ai
        const br = bi === -1 ? qEnTerms.length : bi
        if (ar !== br) return ar - br
      }
      const la = primaryField ? (a[primaryField.replace('e.', '')] || '').length : 0
      const lb = primaryField ? (b[primaryField.replace('e.', '')] || '').length : 0
      if (la !== lb) return la - lb
      return a.source_id - b.source_id || a.sort_order - b.sort_order
    })
    entries = { results: allEntries }
  }

  const groups: Map<number, { source: any; count: number; entries: any[] }> = new Map()
  for (const entry of entries.results as any[]) {
    if (!groups.has(entry.source_id)) {
      groups.set(entry.source_id, {
        source: { id: entry.source_id, name: entry.source_name, name_zh: entry.source_name_zh, year: entry.source_year, original_fields: entry.source_original_fields },
        count: sourceTotalMap.get(entry.source_id) || 0,
        entries: []
      })
    }
    groups.get(entry.source_id)!.entries.push({
      id: entry.id,
      han: entry.han,
      puj: entry.puj,
      dp: entry.dp,
      en: entry.en,
      mandarin: entry.mandarin,
      ja: entry.ja,
      han_orig: entry.han_orig,
      puj_orig: entry.puj_orig,
      en_orig: entry.en_orig,
      page_num: entry.page_num,
      source_id: entry.source_id,
      section_title: entry.section_title,
    })
  }

  return {
    total: countResult?.total || 0,
    page: params.page,
    groups: [...groups.values()],
    ...(matchMeta ? { match_meta: matchMeta } : {})
  }
}

export async function searchEntries(db: D1Database, params: SearchParams) {
  if (!params.q_mandarin) return runSearchEntries(db, params)

  const traditional = toTraditional(params.q_mandarin)
  const direct = await runSearchEntries(db, params, { mode: 'direct' })
  logMandarinBridge({
    event: 'direct_result',
    input: params.q_mandarin,
    traditional,
    directTotal: direct.total,
  })
  if (direct.total > 0) return direct

  const bridgeTerms = await findMandarinBridgeTerms(
    db,
    uniqueTerms(params.q_mandarin, traditional)
  )
  logMandarinBridge({
    event: 'bridge_terms',
    input: params.q_mandarin,
    traditional,
    bridgeTerms,
  })
  if (bridgeTerms.length === 0) {
    return { total: 0, page: params.page, groups: [], match_meta: { mode: 'mandarin_bridge' as const, bridge_terms: [] } }
  }

  const bridge = await runSearchEntries(
    db,
    { ...params, q_mandarin: undefined, q_en: undefined, q_en_terms: bridgeTerms },
    { mode: 'mandarin_bridge', bridge_terms: bridgeTerms }
  )
  logMandarinBridge({
    event: 'bridge_result',
    input: params.q_mandarin,
    traditional,
    bridgeTerms,
    bridgeTotal: bridge.total,
  })
  return bridge
}
