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
  const conditions: string[] = []
  const values: any[] = []

  if (params.q_han) { conditions.push('e.han LIKE ?'); values.push(`%${params.q_han}%`) }
  if (params.q_puj) { conditions.push('e.puj LIKE ?'); values.push(`%${params.q_puj}%`) }
  if (params.q_dp) { conditions.push('e.dp LIKE ?'); values.push(`%${params.q_dp}%`) }
  if (params.q_en) { conditions.push('e.en LIKE ?'); values.push(`%${params.q_en}%`) }
  if (params.q_mandarin) { conditions.push('e.mandarin LIKE ?'); values.push(`%${params.q_mandarin}%`) }
  if (params.q_ja) { conditions.push('e.ja LIKE ?'); values.push(`%${params.q_ja}%`) }
  if (params.source_id) { conditions.push('e.source_id = ?'); values.push(params.source_id) }

  if (conditions.length === 0) {
    return { total: 0, page: params.page, groups: [] }
  }

  const where = conditions.join(' AND ')

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM entries e WHERE ${where}`
  ).bind(...values).first<{ total: number }>()

  const primaryField = (params.q_han && 'e.han')
    || (params.q_puj && 'e.puj')
    || (params.q_dp && 'e.dp')
    || (params.q_en && 'e.en')
    || (params.q_mandarin && 'e.mandarin')
    || (params.q_ja && 'e.ja')
    || null
  const relevanceOrder = primaryField
    ? `LENGTH(${primaryField})`
    : '0'

  const offset = (params.page - 1) * params.limit
  const entries = await db.prepare(
    `SELECT e.*, s.name as source_name, s.year as source_year
     FROM entries e
     JOIN sources s ON e.source_id = s.id
     WHERE ${where}
     ORDER BY ${relevanceOrder}, e.source_id, e.sort_order
     LIMIT ? OFFSET ?`
  ).bind(...values, params.limit, offset).all()

  const groups: Map<number, { source: any; count: number; entries: any[] }> = new Map()
  for (const entry of entries.results as any[]) {
    if (!groups.has(entry.source_id)) {
      groups.set(entry.source_id, {
        source: { id: entry.source_id, name: entry.source_name, year: entry.source_year },
        count: 0,
        entries: []
      })
    }
    const group = groups.get(entry.source_id)!
    group.count++
    group.entries.push({
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
    })
  }

  return {
    total: countResult?.total || 0,
    page: params.page,
    groups: [...groups.values()]
  }
}
