export async function getEntryById(db: D1Database, id: number) {
  const entry = await db.prepare(
    `SELECT e.*, s.name as source_name, s.year as source_year
     FROM entries e
     JOIN sources s ON e.source_id = s.id
     WHERE e.id = ?`
  ).bind(id).first<any>()

  if (!entry) return null

  const examples = await db.prepare(
    'SELECT * FROM examples WHERE entry_id = ? ORDER BY sort_order'
  ).bind(id).all()

  return {
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
    source: { id: entry.source_id, name: entry.source_name, year: entry.source_year },
    examples: (examples.results as any[]).map((ex) => ({
      teochew: ex.teochew,
      puj: ex.puj,
      translation: ex.translation,
    })),
  }
}
