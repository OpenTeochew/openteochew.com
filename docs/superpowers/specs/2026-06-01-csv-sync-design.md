# CSV Incremental Sync Design

## Goal

Sync dictionary entries from `hokkien-writing` repo's CSV files into OpenTeochew's D1 database, triggered automatically when the CSV changes on main branch. Uses incremental diff (old vs new CSV snapshot) to generate minimal INSERT/UPDATE/DELETE SQL.

## Scope

- Phase 1: Only `001_Handbook_of_the_Swatow_Vernacular.csv` (6172 rows, 54 sections)
- Other CSVs (002, ssmp) have different column structures — deferred

## Data Source

```
/Users/lim/Documents/Code/hokkien-writing/dataset/export/books/001_Handbook_of_the_Swatow_Vernacular.csv
```

Columns: `puj, puj_orig, poj, poj_orig, han, han_orig, en, en_orig, zh_TW, zh_CN, source`

Field coverage for 001:
- `puj`: 6172/6172 (always present)
- `han`: 6085/6172
- `en`: 6172/6172
- `han_orig`: 2019/6172
- `source`: 6172/6172 — format: `"001_Handbook_of_the_Swatow_Vernacular > Lesson XXV. relationships."`
- `poj`, `poj_orig`, `zh_TW`, `zh_CN`: all empty for this CSV

## _orig Fields Semantics

The CSV contains user corrections to the original source material:
- When `_orig` field is **non-empty**: the standardized field (`puj`/`han`/`en`) holds the **corrected** version, `_orig` holds the **original** from the printed source
- When `_orig` field is **empty**: the standardized field is unchanged from the original — no correction was needed

Example: `han=阿母, han_orig=亞母` means a user corrected 亞母 → 阿母

The DB stores both. The UI shows the corrected version by default, with an indicator where `_orig` is non-empty — hover/click to reveal the original.

## CSV → DB Mapping

| CSV field | DB column | Notes |
|-----------|-----------|-------|
| `puj` | `entries.puj` | Corrected (or original if unchanged) |
| `han` | `entries.hanzi` | Corrected (or original if unchanged) |
| `en` | `entries.en` | Corrected (or original if unchanged) |
| `source` (after `>`) | `sections.title` | Parsed from source field |
| `puj_orig` | `entries.puj_orig` | **New column** — original if corrected, NULL if unchanged |
| `han_orig` | `entries.han_orig` | **New column** — original if corrected, NULL if unchanged |
| `en_orig` | `entries.en_orig` | **New column** — original if corrected, NULL if unchanged |

### Schema change

```sql
ALTER TABLE entries ADD COLUMN puj_orig TEXT;
ALTER TABLE entries ADD COLUMN han_orig TEXT;
ALTER TABLE entries ADD COLUMN en_orig TEXT;
```

## UI: Showing Original Content

In entry display pages (SearchResults, EntryDetail, SourceViewer), for any field where `_orig` is non-empty:
- Show the corrected value as primary text
- Display a small visual indicator (e.g. pencil icon or dotted underline) next to the corrected field
- On hover or click, reveal the original value with a label like "原：亞母"

Applies to: `hanzi` (vs `han_orig`), `puj` (vs `puj_orig`), `en` (vs `en_orig`).

### Frontend changes

- `web/src/types/entry.ts` — add optional `han_orig`, `puj_orig`, `en_orig` fields
- Entry display components — add `<OrigTooltip>` inline component for corrected fields

## Diff Logic

### Natural key

`(puj, han, en, section_title)` — same puj+han can appear in multiple sections or with different definitions.

### Algorithm

1. `git show HEAD~1:path` → old CSV, `git show HEAD:path` → new CSV
2. Parse both into arrays of row objects
3. Build a `Map<naturalKey, row>` for each
4. Compare:
   - **Added**: key in new but not old → INSERT entry (create section if needed)
   - **Modified**: key in both but fields differ → UPDATE entry
   - **Removed**: key in old but not new → DELETE entry (delete section if empty)

### Section handling

- Parse `source` field: `"001_Handbook_of_the_Swatow_Vernacular > Lesson XXV. relationships."` → section title = `"Lesson XXV. relationships."`
- Sections keyed by `(source_id, title)`, auto-created on first appearance
- When all entries of a section are removed, delete the section

## Execution

Script: `scripts/sync-csv.mjs`

```
node scripts/sync-csv.mjs \
  --csv-path dataset/export/books/001_Handbook_of_the_Swatow_Vernacular.csv \
  --source-id 1 \
  --git-range HEAD~1..HEAD
```

Steps:
1. `git show` reads old and new CSV snapshots
2. Parse CSVs
3. Diff and categorize rows
4. Generate batch SQL statements
5. Execute via `wrangler d1 execute --remote`

## CI Workflow (hokkien-writing repo)

```yaml
# .github/workflows/sync-to-openteochew.yml
name: Sync CSV to OpenTeochew
on:
  push:
    branches: [main]
    paths: ['dataset/export/books/001_*.csv']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: actions/checkout@v4
        with:
          repository: OpenTeochew/openteochew.com
          path: openteochew
          token: ${{ secrets.OPENTEOCHEW_PAT }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Sync
        working-directory: openteochew
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          npm install -g wrangler
          node scripts/sync-csv.mjs \
            --csv-path ../dataset/export/books/001_Handbook_of_the_Swatow_Vernacular.csv \
            --source-id 1 \
            --git-range HEAD~1..HEAD
```

## Files to create/modify

| File | Action |
|------|--------|
| `scripts/sync-csv.mjs` | Create — main sync script |
| `scripts/sync-csv.test.mjs` | Create — tests for diff logic |
| `scripts/004_add_orig_columns.sql` | Create — ALTER TABLE for new columns |
| `web/src/types/entry.ts` | Modify — add orig fields |
| Entry display components | Modify — OrigTooltip for corrected fields |
| `docs/design/architecture.md` | Update — document sync mechanism |

## Edge cases

- **First run (no old version)**: Treat as full import — all rows are "added"
- **CSV header changes**: Script validates expected columns; fail with clear error if mismatch
- **Merge commits with multiple CSV changes**: git diff handles this; compare base vs HEAD
- **Wrangler batch size limits**: D1 has ~100KB per statement; batch SQL in chunks of ~500 rows
