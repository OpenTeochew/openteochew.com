import OpenCC from 'opencc-js'

const s2t = OpenCC.Converter({ from: 'cn', to: 'tw' })

function toTraditional(s?: string): string | undefined {
  return s ? s2t(s) : s
}

export async function searchEntries(
  db: D1Database,
  params: {
    q_han?: string
    q_puj?: string
    q_dp?: string
    q_en?: string
    q_mandarin?: string
    q_ja?: string
    source_id?: number
    page: number
    limit: number
  }
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
  if (params.q_puj) { conditions.push('(e.puj LIKE ? OR e.puj_orig LIKE ?)'); values.push(`%${params.q_puj}%`, `%${params.q_puj}%`) }
  if (params.q_dp) { conditions.push('e.dp LIKE ?'); values.push(`%${params.q_dp}%`) }
  if (params.q_en) { conditions.push('(e.en LIKE ? OR e.en_orig LIKE ?)'); values.push(`%${params.q_en}%`, `%${params.q_en}%`) }
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
    return { total: 0, page: params.page, groups: [] }
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
  function escLike(s: string) {
    return s.replace(/[%_\\]/g, '\\$&')
  }

  const primaryField = (q_han && 'e.han')
    || (params.q_puj && 'e.puj')
    || (params.q_dp && 'e.dp')
    || (params.q_en && 'e.en')
    || (q_mandarin && 'e.mandarin')
    || (params.q_ja && 'e.ja')
    || null

  const boostParts: string[] = []
  if (origHan && origHan !== q_han && primaryField) {
    boostParts.push(`CASE WHEN ${primaryField} LIKE '%${escLike(origHan)}%' ESCAPE '\\' THEN 0 ELSE 1 END`)
  }
  if (primaryField) boostParts.push(`LENGTH(${primaryField})`)
  const relevanceOrder = boostParts.length > 0 ? boostParts.join(', ') : '0'

  const offset = (params.page - 1) * params.limit
  let entries
  if (params.source_id) {
    entries = await db.prepare(
      `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, sec.title as section_title
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
        `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, sec.title as section_title
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
        source: { id: entry.source_id, name: entry.source_name, name_zh: entry.source_name_zh, year: entry.source_year },
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
    groups: [...groups.values()]
  }
}
