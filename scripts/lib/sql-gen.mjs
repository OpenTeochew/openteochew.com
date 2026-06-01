import { parseSection } from './section-resolve.mjs'

export function generateSql(sourceId, diffResult, existingSections) {
  const statements = []
  const sectionMap = new Map(existingSections.map((s) => [s.title, s.id]))
  let nextSectionId = existingSections.length > 0
    ? Math.max(...existingSections.map((s) => s.id)) + 1
    : 1

  function getOrCreateSection(title) {
    if (!title) return 'NULL'
    if (sectionMap.has(title)) return String(sectionMap.get(title))
    const id = nextSectionId++
    sectionMap.set(title, id)
    statements.push(
      `INSERT INTO sections (id, source_id, title, sort_order) VALUES (${id}, ${sourceId}, '${sqlEscape(title)}', ${sectionMap.size});`
    )
    return String(id)
  }

  for (const row of diffResult.added) {
    const sectionTitle = parseSection(row.source)
    const sectionId = getOrCreateSection(sectionTitle)
    statements.push(
      `INSERT INTO entries (source_id, section_id, hanzi, puj, en, han_orig, puj_orig, en_orig, sort_order) VALUES (${sourceId}, ${sectionId}, ${sqlVal(row.han)}, ${sqlVal(row.puj)}, ${sqlVal(row.en)}, ${sqlVal(row.han_orig)}, ${sqlVal(row.puj_orig)}, ${sqlVal(row.en_orig)}, 0);`
    )
  }

  for (const row of diffResult.modified) {
    const sectionTitle = parseSection(row.source)
    const sectionId = getOrCreateSection(sectionTitle)
    statements.push(
      `UPDATE entries SET hanzi = ${sqlVal(row.han)}, puj = ${sqlVal(row.puj)}, en = ${sqlVal(row.en)}, han_orig = ${sqlVal(row.han_orig)}, puj_orig = ${sqlVal(row.puj_orig)}, en_orig = ${sqlVal(row.en_orig)}, section_id = ${sectionId} WHERE source_id = ${sourceId} AND puj = ${sqlVal(row.puj)} AND hanzi = ${sqlVal(row.han)} AND en = ${sqlVal(row.en)};`
    )
  }

  for (const row of diffResult.removed) {
    const sectionTitle = parseSection(row.source)
    statements.push(
      `DELETE FROM entries WHERE source_id = ${sourceId} AND puj = ${sqlVal(row.puj)} AND hanzi = ${sqlVal(row.han)} AND en = ${sqlVal(row.en)} AND section_id IN (SELECT id FROM sections WHERE source_id = ${sourceId} AND title = ${sqlVal(sectionTitle)});`
    )
  }

  return statements
}

function sqlVal(val) {
  if (!val) return 'NULL'
  return `'${sqlEscape(val)}'`
}

function sqlEscape(str) {
  return str.replace(/'/g, "''")
}
