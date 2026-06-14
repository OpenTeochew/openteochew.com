import { parseSection } from './section-resolve.mjs'

export function generateSql(sourceId, diffResult, existingSections) {
  const statements = []
  const existingTitles = new Set(existingSections.map((s) => s.title))
  const newSections = new Set()

  for (const row of diffResult.added) {
    const sectionTitle = parseSection(row.source)
    if (sectionTitle && !existingTitles.has(sectionTitle) && !newSections.has(sectionTitle)) {
      newSections.add(sectionTitle)
    }
  }

  for (const title of newSections) {
    statements.push(
      `INSERT OR IGNORE INTO sections (source_id, title, sort_order) VALUES (${sourceId}, '${sqlEscape(title)}', 0);`
    )
  }

  function sectionSubquery(title) {
    if (!title) return 'NULL'
    return `(SELECT id FROM sections WHERE source_id = ${sourceId} AND title = '${sqlEscape(title)}' LIMIT 1)`
  }

  for (const row of diffResult.added) {
    const sectionTitle = parseSection(row.source)
    statements.push(
      `INSERT INTO entries (source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order) VALUES (${sourceId}, ${sectionSubquery(sectionTitle)}, ${sqlVal(row.han)}, ${sqlVal(row.puj)}, ${sqlVal(row.dp)}, ${sqlVal(row.latn_norm)}, ${sqlVal(row.en)}, ${sqlVal(row.han_orig)}, ${sqlVal(row.puj_orig)}, ${sqlVal(row.en_orig)}, ${sqlNum(row.page_num)}, 0);`
    )
  }

  for (const row of diffResult.modified) {
    const sectionTitle = parseSection(row.source)
    statements.push(
      `UPDATE entries SET han = ${sqlVal(row.han)}, puj = ${sqlVal(row.puj)}, dp = ${sqlVal(row.dp)}, latn_norm = ${sqlVal(row.latn_norm)}, en = ${sqlVal(row.en)}, han_orig = ${sqlVal(row.han_orig)}, puj_orig = ${sqlVal(row.puj_orig)}, en_orig = ${sqlVal(row.en_orig)}, page_num = ${sqlNum(row.page_num)}, section_id = ${sectionSubquery(sectionTitle)} WHERE source_id = ${sourceId} AND puj = ${sqlVal(row.puj)} AND han = ${sqlVal(row.han)} AND en = ${sqlVal(row.en)};`
    )
  }

  for (const row of diffResult.removed) {
    const sectionTitle = parseSection(row.source)
    statements.push(
      `DELETE FROM entries WHERE source_id = ${sourceId} AND puj = ${sqlVal(row.puj)} AND han = ${sqlVal(row.han)} AND en = ${sqlVal(row.en)} AND section_id = ${sectionSubquery(sectionTitle)};`
    )
  }

  return statements
}

function sqlVal(val) {
  if (!val) return 'NULL'
  return `'${sqlEscape(val)}'`
}

function sqlNum(val) {
  const n = parseInt(val, 10)
  return isNaN(n) ? 'NULL' : String(n)
}

function sqlEscape(str) {
  return str.replace(/'/g, "''")
}
