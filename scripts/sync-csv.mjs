#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { parseCsv } from './lib/csv-parse.mjs'
import { parseSection } from './lib/section-resolve.mjs'
import { diffRows } from './lib/diff.mjs'
import { generateSql } from './lib/sql-gen.mjs'

const args = process.argv.slice(2)
let csvPath = ''
let sourceId = 0
let gitRange = 'HEAD~1..HEAD'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--csv-path' && args[i + 1]) { csvPath = args[++i]; continue }
  if (args[i] === '--source-id' && args[i + 1]) { sourceId = Number(args[++i]); continue }
  if (args[i] === '--git-range' && args[i + 1]) { gitRange = args[++i]; continue }
}

if (!csvPath || !sourceId) {
  console.error('Usage: sync-csv.mjs --csv-path <path> --source-id <id> [--git-range HEAD~1..HEAD]')
  process.exit(1)
}

const [oldRef, newRef] = gitRange.split('..')

function gitShow(ref, path) {
  try {
    return execSync(`git show "${ref}:${path}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 })
  } catch {
    return null
  }
}

function annotateSections(rows) {
  return rows.map((row) => {
    row._section = parseSection(row.source)
    return row
  })
}

console.log('Reading CSV snapshots...')
const oldText = gitShow(oldRef, csvPath)
const newText = gitShow(newRef, csvPath)

if (!newText) {
  console.error('ERROR: Cannot read new CSV version. Does the file exist at this git ref?')
  process.exit(1)
}

const newRows = annotateSections(parseCsv(newText))
console.log(`New CSV: ${newRows.length} rows`)

let oldRows = []
if (oldText) {
  oldRows = annotateSections(parseCsv(oldText))
  console.log(`Old CSV: ${oldRows.length} rows`)
} else {
  console.log('No old version found — treating as full import')
}

console.log('Diffing...')
const diffResult = diffRows(oldRows, newRows)
console.log(`Added: ${diffResult.added.length}, Modified: ${diffResult.modified.length}, Removed: ${diffResult.removed.length}`)

if (diffResult.added.length === 0 && diffResult.modified.length === 0 && diffResult.removed.length === 0) {
  console.log('No changes detected.')
  process.exit(0)
}

console.log('Generating SQL...')
const sqlStatements = generateSql(sourceId, diffResult, [])
const batchSize = 100
const tmpFile = `/tmp/sync-csv-${Date.now()}.sql`

for (let i = 0; i < sqlStatements.length; i += batchSize) {
  const batch = sqlStatements.slice(i, i + batchSize).join('\n')
  writeFileSync(tmpFile, batch)
  console.log(`  Executing batch ${Math.floor(i / batchSize) + 1} (${batch.split('\n').length} statements)...`)
  execSync(`npx wrangler d1 execute openteochew-db --remote --file=${tmpFile}`, { stdio: 'inherit' })
}

try { unlinkSync(tmpFile) } catch {}
console.log('Sync complete.')
