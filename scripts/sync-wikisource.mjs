#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const sectionToSubpage = {
  'Lesson I.': 'Introductory',
  'Lesson II.': 'Introductory',
  'Lesson III. Exercises.': 'Introductory',
  'Lesson IV. A List of Introductory Verbs.': 'A_List_of_Introductory_Verbs',
  'Lesson V.': 'Exercises_(Lesson_V)',
  'Lesson VI. A List of Introductory Adjectives.': 'A_List_of_Introductory_Adjectives',
  'Lesson VII.': 'Exercises_(Lesson_VII)',
  'Lesson VIII. numeral.': 'Numeral',
  'Lesson IX.': 'Tones,_Hyphens',
  'Lesson X.': 'Grammar',
  'section I.': 'Grammar',
  'section II.': 'Grammar',
  'section III.': 'Grammar',
  'section IV.': 'Grammar',
  'section V.': 'Grammar',
  'present tense.': 'Grammar',
  'past tense.': 'Grammar',
  'perfect tense.': 'Grammar',
  'future tense.': 'Grammar',
  'potential mood.': 'Grammar',
  'the comparative degree.': 'Grammar',
  'the superlative degree.': 'Grammar',
  'Lesson XI.': 'Time_generally',
  'Lesson XII.': 'A_Building_%26c.',
  'Lesson XIII.': 'Human_Body_%26c.',
  'Lesson XIV. household furniture &c.': 'Household_Furniture_%26c.',
  'Dining Room.': 'Household_Furniture_%26c.',
  'Bed Room.': 'Household_Furniture_%26c.',
  'Kitchen.': 'Household_Furniture_%26c.',
  'Lesson XV. garden.': 'Garden',
  'Lesson XVI. a list of words used in cooking.': 'A_List_of_Words_used_in_Cooking',
  'Lesson XVII.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Provisions.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Fish.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Vegetables.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Fruit.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Lesson XVIII. on dress.': 'On_Dress',
  'Lesson XIX. nautical.': 'Nautical',
  'Lesson XX. medical.': 'Medical',
  'Lesson XXI.': 'Commercial',
  'Commercial.': 'Commercial',
  'Piece-goods.': 'Commercial',
  'Mineral &c.': 'Commercial',
  'Miscellaneous Articles.': 'Commercial',
  'Carpentry.': 'Commercial',
  'Tailoring.': 'Commercial',
  'Accounts.': 'Commercial',
  'Monetary.': 'Commercial',
  'A List of words used in Commerce.': 'Commercial',
  'Weights and measures.': 'Commercial',
  'Lesson XXII. judicial.': 'Judicial',
  'Lesson XXIII. hostilities.': 'Hostilities',
  'Lesson XXIV. religious.': 'Religious',
  'Lesson XXV. relationships.': 'Relationships',
  'Lesson XXVI. a list of animals and birds.': 'A_List_of_Animals_and_Birds',
  'Lesson XXVII. a list of classifiers.': 'A_List_of_Classifiers',
  'Lesson XXVIII. Notes—Nautical.': 'Notes%E2%80%94Nautical',
  'Lesson XXIX. Notes—Medical.': 'Notes%E2%80%94Medical',
  'Lesson XXX. Notes—Commercial.': 'Notes%E2%80%94Commercial',
  'Lesson XXXI. Notes—Judicial.': 'Notes%E2%80%94Judicial',
  'Lesson XXXII. Notes—Hostilities.': 'Notes%E2%80%94Hostilities',
  'Lesson XXXIII. Notes—Religious.': 'Notes%E2%80%94Religious',
  'A Dictionary of some of the more important words in the Swatow dialect.': 'A_Dictionary_of_some_of_the_more_important_words_in_the_Swatow_dialect',
  'External.': 'Human_Body_%26c.',
}

const uniqueSubpages = [...new Set(Object.values(sectionToSubpage))]
const BASE_URL = 'https://en.wikisource.org/wiki/Handbook_of_the_Swatow_Vernacular/'
const backendDir = new URL('../backend', import.meta.url).pathname
const workDir = mkdtempSync(join(tmpdir(), 'sync-wiki-'))

console.log(`Unique subpages to fetch: ${uniqueSubpages.length}`)

const subpageToSections = new Map()
for (const [sectionTitle, subpage] of Object.entries(sectionToSubpage)) {
  if (!subpageToSections.has(subpage)) subpageToSections.set(subpage, [])
  subpageToSections.get(subpage).push(sectionTitle)
}

async function fetchUrl(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return execSync(`curl -s --connect-timeout 15 --max-time 60 -A "Mozilla/5.0" "${url}"`, {
        encoding: 'utf-8',
        maxBuffer: 20 * 1024 * 1024,
      })
    } catch (e) {
      console.log(`  Attempt ${attempt}/${retries} failed: ${e.message.slice(0, 80)}`)
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * attempt))
      else throw e
    }
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitByPageMarkers(html) {
  const pages = []
  const markerRe = /<span[^>]*class="pagenum ws-pagenum"[^>]*>/g
  const positions = []
  let m
  while ((m = markerRe.exec(html)) !== null) {
    const tag = m[0]
    const pageNumMatch = tag.match(/data-page-number="([^"]+)"/)
    const pageIdxMatch = tag.match(/data-page-index="([^"]+)"/)
    if (pageNumMatch && pageIdxMatch && /^\d+$/.test(pageNumMatch[1])) {
      positions.push({
        markerEnd: m.index + m[0].length,
        pageNumber: Number(pageNumMatch[1]),
        pageIndex: Number(pageIdxMatch[1]),
      })
    }
  }
  if (positions.length === 0) return pages
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].markerEnd
    const end = i + 1 < positions.length
      ? positions[i + 1].markerEnd - positions[i + 1].pageNumber.toString().length - 50
      : html.length
    const chunk = html.substring(start, end)
    pages.push({
      pageNumber: positions[i].pageNumber,
      pageIndex: positions[i].pageIndex,
      ocrText: stripHtml(chunk),
    })
  }
  return pages
}

function queryD1(sql) {
  const qFile = join(workDir, `q-${Date.now()}.sql`)
  const outFile = join(workDir, `r-${Date.now()}.json`)
  writeFileSync(qFile, sql)
  execSync(
    `npx wrangler d1 execute openteochew-db --local --json --file=${qFile} > ${outFile}`,
    { encoding: 'utf-8', cwd: backendDir },
  )
  try { unlinkSync(qFile) } catch {}
  const raw = readFileSync(outFile, 'utf-8')
  try { unlinkSync(outFile) } catch {}
  return JSON.parse(raw)[0].results
}

console.log('\n--- Fetching wikisource subpages ---')
const subpageData = new Map()
for (const subpage of uniqueSubpages) {
  const url = BASE_URL + subpage
  console.log(`Fetching: ${decodeURIComponent(subpage)}`)
  const html = await fetchUrl(url)
  const pages = splitByPageMarkers(html)
  console.log(`  ${pages.length} pages (${pages[0]?.pageNumber ?? '?'}–${pages[pages.length - 1]?.pageNumber ?? '?'})`)
  subpageData.set(subpage, pages)
  await new Promise((r) => setTimeout(r, 200))
}

console.log('\n--- Querying D1 ---')
const sections = queryD1('SELECT id, title FROM sections WHERE source_id = 1;')
const sectionMap = new Map()
for (const s of sections) sectionMap.set(s.title, s.id)
console.log(`Sections: ${sections.length}`)

const sectionTitles = Object.keys(sectionToSubpage)
const escapedTitles = sectionTitles.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')
const entries = queryD1(
  `SELECT e.id, e.puj, e.han, e.han_orig, e.en, e.section_id, s.title as section_title ` +
  `FROM entries e JOIN sections s ON e.section_id = s.id ` +
  `WHERE e.source_id = 1 AND s.title IN (${escapedTitles});`,
)
console.log(`Entries: ${entries.length}`)

const entriesBySubpage = new Map()
for (const entry of entries) {
  const subpage = sectionToSubpage[entry.section_title]
  if (!subpage) continue
  if (!entriesBySubpage.has(subpage)) entriesBySubpage.set(subpage, [])
  entriesBySubpage.get(subpage).push(entry)
}

console.log('\n--- Matching entries to pages ---')
let matched = 0
let unmatched = 0
const sqlStatements = []

const sourceSectionIds = [...new Set(entries.map((e) => e.section_id))]
sqlStatements.push(`DELETE FROM pages WHERE section_id IN (${sourceSectionIds.join(',')});`)

const pagesWithOcr = new Set()

for (const [subpage, pages] of subpageData) {
  const subpageEntries = entriesBySubpage.get(subpage) || []
  const sectionsForSubpage = subpageToSections.get(subpage) || []
  const firstSectionId = sectionMap.get(sectionsForSubpage[0])

  for (const page of pages) {
    if (page.ocrText.length > 0 && firstSectionId) {
      const escapedOcr = page.ocrText.replace(/\\/g, '\\\\').replace(/'/g, "''")
      sqlStatements.push(
        `INSERT INTO pages (section_id, page_num, image_url, ocr_text, sort_order) ` +
        `VALUES (${firstSectionId}, ${page.pageNumber}, '/scans/1/${String(page.pageIndex).padStart(3, '0')}.png', '${escapedOcr}', 0);`,
      )
      pagesWithOcr.add(page.pageNumber)
    }
  }

  for (const entry of subpageEntries) {
    const matchText = entry.han_orig || entry.han
    if (!matchText) {
      unmatched++
      continue
    }

    const candidatePages = []
    for (const page of pages) {
      const idx = page.ocrText.indexOf(matchText)
      if (idx !== -1) candidatePages.push({ page, matchIdx: idx })
    }

    if (candidatePages.length === 1) {
      sqlStatements.push(`UPDATE entries SET page_num = ${candidatePages[0].page.pageNumber} WHERE id = ${entry.id};`)
      matched++
    } else if (candidatePages.length > 1) {
      const enWords = (entry.en || '').split(/[\s,;]+/).filter((w) => /^[a-zA-Z]+$/.test(w) && w.length >= 3)
      const enWord = enWords[0] || null
      let bestPage = candidatePages[0]
      if (enWord) {
        for (const cp of candidatePages) {
          const before = cp.page.ocrText.substring(Math.max(0, cp.matchIdx - 200), cp.matchIdx).toLowerCase()
          if (before.includes(enWord.toLowerCase())) {
            bestPage = cp
            break
          }
        }
      }
      sqlStatements.push(`UPDATE entries SET page_num = ${bestPage.page.pageNumber} WHERE id = ${entry.id};`)
      matched++
    } else {
      const fallbackPage = pages.length > 0 ? pages[0].pageNumber : null
      if (fallbackPage) {
        sqlStatements.push(`UPDATE entries SET page_num = ${fallbackPage} WHERE id = ${entry.id};`)
      }
      unmatched++
    }
  }
}

sqlStatements.push(`UPDATE sources SET total_pages = 304, pdf_offset = 16 WHERE id = 1;`)

console.log(`\nGenerated ${sqlStatements.length} SQL statements`)

const sqlFile = join(workDir, 'sync.sql')
writeFileSync(sqlFile, sqlStatements.join('\n') + '\n')

console.log('Executing against local D1...')
execSync(`npx wrangler d1 execute openteochew-db --local --file=${sqlFile}`, {
  stdio: 'inherit',
  cwd: backendDir,
})

try { rmSync(workDir, { recursive: true }) } catch {}

console.log('\n=== Sync complete ===')
console.log(`  Entries matched:   ${matched}`)
console.log(`  Entries unmatched: ${unmatched}`)
console.log(`  Pages with OCR:    ${pagesWithOcr.size}`)
