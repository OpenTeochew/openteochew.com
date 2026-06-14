# latn_norm 搜尋支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓用戶用鍵盤輸入 PUJ（數字調號）和 DP 查詢詞條，透過 latn_norm 標準化匹配，結果按匹配程度排序。

**Architecture:** 在 DB 新增 `latn_norm` 欄位，sync 時從 dataset 的 latn 轉換器生成。搜尋時用 TypeScript normalizer 將用戶輸入轉為 latn_norm 候選，匹配 `latn_norm` + 原始欄位（`puj`/`dp`），按 tier 排序。

**Tech Stack:** TypeScript (Hono/Workers backend), Python (sync scripts), SQLite (D1), vitest (tests)

**Spec:** `docs/superpowers/specs/2026-06-14-latn-norm-search-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/003_add_latn_norm.sql` | Create | Schema migration |
| `backend/src/server/services/normalize.ts` | Create | TS normalizer: PUJ/DP → latn_norm |
| `backend/src/server/services/normalize.test.ts` | Create | Normalizer unit tests |
| `backend/src/server/services/search.ts` | Modify | 整合 latn_norm 匹配 + tier 排序 |
| `backend/package.json` | Modify | 加 vitest devDependency |
| `scripts/sync-source.py` | Modify | 生成 latn_norm + 寫入 dp |
| `scripts/lib/sql-gen.mjs` | Modify | 加 latn_norm 欄位 |
| `scripts/full-sync.py` | Modify | 加 latn_norm 欄位（一致性） |

---

### Task 1: Schema Migration

**Files:**
- Create: `scripts/003_add_latn_norm.sql`

- [ ] **Step 1: Create migration SQL**

```sql
ALTER TABLE entries ADD COLUMN latn_norm TEXT;
CREATE INDEX IF NOT EXISTS idx_entries_latn_norm ON entries(latn_norm);
```

- [ ] **Step 2: Test migration on local dev DB**

Run: `npx wrangler d1 execute openteochew-db-dev --local --command "ALTER TABLE entries ADD COLUMN latn_norm TEXT; CREATE INDEX IF NOT EXISTS idx_entries_latn_norm ON entries(latn_norm);"`
Expected: success

Verify: `npx wrangler d1 execute openteochew-db-dev --local --command "PRAGMA table_info(entries);"`
Expected: `latn_norm` row present

- [ ] **Step 3: Commit**

```bash
git add scripts/003_add_latn_norm.sql
git commit -m "feat: add latn_norm column migration"
```

---

### Task 2: Normalizer — Setup + Failing Tests

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/server/services/normalize.test.ts`

- [ ] **Step 1: Add vitest devDependency**

Run: `cd backend && npm install --save-dev vitest`

Add test script to `backend/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests**

Create `backend/src/server/services/normalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeToLatnNorm } from './normalize'

describe('normalizeToLatnNorm — PUJ', () => {
  it('converts ts before a/o/u to ch', () => {
    expect(normalizeToLatnNorm('tsa5', 'puj')).toEqual(['cha5'])
  })

  it('converts tsh before a/o/u to chh', () => {
    expect(normalizeToLatnNorm('tshang5', 'puj')).toEqual(['chhang5'])
  })

  it('converts z before a/o/u to j', () => {
    expect(normalizeToLatnNorm('zang5', 'puj')).toEqual(['jang5'])
  })

  it('keeps ch/chh/j before i/e unchanged', () => {
    expect(normalizeToLatnNorm('chin5', 'puj')).toEqual(['chin5'])
    expect(normalizeToLatnNorm('chhin5', 'puj')).toEqual(['chhin5'])
  })

  it('converts superscript n to nn', () => {
    expect(normalizeToLatnNorm('tsua\u207F3', 'puj')).toEqual(['chuann3'])
  })

  it('handles multi-syllable input', () => {
    expect(normalizeToLatnNorm('tsa5-chin5', 'puj')).toEqual(['cha5-chin5'])
  })

  it('handles consonant-initial nasalized vowel', () => {
    expect(normalizeToLatnNorm('kuann5', 'puj')).toEqual(['kuann5'])
  })
})

describe('normalizeToLatnNorm — DP', () => {
  it('maps DP initials to latn_norm', () => {
    expect(normalizeToLatnNorm('bang5', 'dp')).toEqual(['pang5'])
    expect(normalizeToLatnNorm('pang5', 'dp')).toEqual(['phang5'])
    expect(normalizeToLatnNorm('zang1', 'dp')).toEqual(['chang1'])
    expect(normalizeToLatnNorm('cang1', 'dp')).toEqual(['chhang1'])
    expect(normalizeToLatnNorm('rang5', 'dp')).toEqual(['jang5'])
  })

  it('maps DP voiced initials', () => {
    expect(normalizeToLatnNorm('bhang5', 'dp')).toEqual(['bang5'])
    expect(normalizeToLatnNorm('ghang5', 'dp')).toEqual(['gang5'])
  })

  it('maps DP entering tone endings', () => {
    expect(normalizeToLatnNorm('zab8', 'dp')).toEqual(['chap8'])
    expect(normalizeToLatnNorm('sad4', 'dp')).toEqual(['sat4'])
    expect(normalizeToLatnNorm('sag4', 'dp')).toEqual(['sak4'])
  })

  it('preserves ng nasal ending (not entering)', () => {
    expect(normalizeToLatnNorm('bang5', 'dp')).toEqual(['pang5'])
  })

  it('maps ao to au', () => {
    expect(normalizeToLatnNorm('hao3', 'dp')).toEqual(['hau3'])
  })

  it('generates e-ambiguity candidates', () => {
    const result = normalizeToLatnNorm('se1', 'dp')
    expect(result).toContain('se1')
    expect(result).toContain('sur1')
    expect(result).toHaveLength(2)
  })

  it('does not generate e-ambiguity for ue/ie', () => {
    expect(normalizeToLatnNorm('hue1', 'dp')).toEqual(['hue1'])
    expect(normalizeToLatnNorm('hie1', 'dp')).toEqual(['hie1'])
  })

  it('handles multi-syllable with e-ambiguity', () => {
    const result = normalizeToLatnNorm('bang5-se1', 'dp')
    expect(result).toContain('pang5-se1')
    expect(result).toContain('pang5-sur1')
  })

  it('passes through unknown initials unchanged', () => {
    expect(normalizeToLatnNorm('mang5', 'dp')).toEqual(['mang5'])
    expect(normalizeToLatnNorm('sang5', 'dp')).toEqual(['sang5'])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/server/services/normalize.test.ts`
Expected: FAIL — module `./normalize` not found

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/server/services/normalize.test.ts
git commit -m "test: add normalizer tests (red)"
```

---

### Task 3: Normalizer — Implementation

**Files:**
- Create: `backend/src/server/services/normalize.ts`

- [ ] **Step 1: Implement normalizeToLatnNorm**

Create `backend/src/server/services/normalize.ts`:

```typescript
export type LatnSystem = 'puj' | 'dp'

export function normalizeToLatnNorm(input: string, system: LatnSystem): string[] {
  if (system === 'puj') return [normalizePuj(input)]
  return normalizeDp(input)
}

function normalizePuj(input: string): string {
  let result = input.replace(/\u207F/g, 'nn')
  result = result.replace(/(^|[-\s])tsh([aou])/g, '$1chh$2')
  result = result.replace(/(^|[-\s])ts([aou])/g, '$1ch$2')
  result = result.replace(/(^|[-\s])z([aou])/g, '$1j$2')
  return result
}

const DP_INITIAL_MAP: [string, string][] = [
  ['bh', 'b'],
  ['gh', 'g'],
  ['ng', 'ng'],
  ['c', 'chh'],
  ['z', 'ch'],
  ['r', 'j'],
  ['p', 'ph'],
  ['t', 'th'],
  ['k', 'kh'],
  ['b', 'p'],
  ['d', 't'],
  ['g', 'k'],
  ['m', 'm'],
  ['n', 'n'],
  ['s', 's'],
  ['l', 'l'],
  ['h', 'h'],
]

const DP_INITIALS = DP_INITIAL_MAP.map(([k]) => k).sort((a, b) => b.length - a.length)

const DP_ENTERING_ENDINGS: Record<string, string> = {
  b: 'p', d: 't', g: 'k', h: 'h',
}

function normalizeDp(input: string): string[] {
  const syllables = input.split(/[-\s]+/).filter((s) => s.length > 0)
  const candidatesPerSyllable = syllables.map(normalizeDpSyllable)
  return cartesian(candidatesPerSyllable).map((parts) => parts.join('-'))
}

function normalizeDpSyllable(syllable: string): string[] {
  const toneMatch = syllable.match(/^(\D*?)([1-8])$/)
  if (!toneMatch) return [syllable]

  const base = toneMatch[1]
  const tone = toneMatch[2]

  let initial = ''
  let rest = base
  for (const dpInitial of DP_INITIALS) {
    if (base.startsWith(dpInitial)) {
      initial = dpInitial
      rest = base.substring(dpInitial.length)
      break
    }
  }

  const mappedInitial = DP_INITIAL_MAP.find(([k]) => k === initial)?.[1] ?? initial

  let vowel = rest
  let mappedEnding = ''
  const endingMatch = rest.match(/(ng|nn|b|d|g|h|m|n)$/)
  if (endingMatch) {
    const ending = endingMatch[1]
    vowel = rest.substring(0, rest.length - ending.length)
    mappedEnding = DP_ENTERING_ENDINGS[ending] ?? ending
  }

  let mappedVowel = vowel.replace(/ao/g, 'au')

  const result = mappedInitial + mappedVowel + mappedEnding + tone

  if (/(?<![\ui])e/.test(mappedVowel)) {
    const variant = result.replace(/(?<![ui])e/g, 'ur')
    return [result, variant]
  }

  return [result]
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = cartesian(rest)
  return first.flatMap((x) => restProduct.map((r) => [x, ...r]))
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/server/services/normalize.test.ts`
Expected: all tests PASS

If any test fails, fix the implementation and re-run until green.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server/services/normalize.ts
git commit -m "feat: implement PUJ/DP to latn_norm normalizer"
```

---

### Task 4: Search Service — latn_norm Matching + Tier Ordering

**Files:**
- Modify: `backend/src/server/services/search.ts`

- [ ] **Step 1: Import normalizer**

Add at top of `search.ts`:

```typescript
import { normalizeToLatnNorm } from './normalize'
```

- [ ] **Step 2: Replace q_puj condition**

Find the existing `q_puj` block (around line 40):

```typescript
if (params.q_puj) { conditions.push('(e.puj LIKE ? OR e.puj_orig LIKE ?)'); values.push(`%${params.q_puj}%`, `%${params.q_puj}%`) }
```

Replace with:

```typescript
if (params.q_puj) {
  const candidates = normalizeToLatnNorm(params.q_puj, 'puj')
  const latnConds = candidates.map(() => 'e.latn_norm LIKE ?')
  const latnVals = candidates.map((c) => `%${c}%`)
  conditions.push(`(${latnConds.join(' OR ')} OR e.puj LIKE ? OR e.puj_orig LIKE ?)`)
  values.push(...latnVals, `%${params.q_puj}%`, `%${params.q_puj}%`)
}
```

- [ ] **Step 3: Replace q_dp condition**

Find the existing `q_dp` block (around line 41):

```typescript
if (params.q_dp) { conditions.push('e.dp LIKE ?'); values.push(`%${params.q_dp}%`) }
```

Replace with:

```typescript
if (params.q_dp) {
  const candidates = normalizeToLatnNorm(params.q_dp, 'dp')
  const latnConds = candidates.map(() => 'e.latn_norm LIKE ?')
  const latnVals = candidates.map((c) => `%${c}%`)
  conditions.push(`(${latnConds.join(' OR ')} OR e.dp LIKE ?)`)
  values.push(...latnVals, `%${params.q_dp}%`)
}
```

- [ ] **Step 4: Update primaryField for latn_norm queries**

Find the `primaryField` assignment (around line 76-82):

```typescript
const primaryField = (q_han && 'e.han')
  || (params.q_puj && 'e.puj')
  || (params.q_dp && 'e.dp')
  || (params.q_en && 'e.en')
  || (q_mandarin && 'e.mandarin')
  || (params.q_ja && 'e.ja')
  || null
```

Replace with:

```typescript
const primaryField = (q_han && 'e.han')
  || (params.q_puj && 'e.latn_norm')
  || (params.q_dp && 'e.latn_norm')
  || (params.q_en && 'e.en')
  || (q_mandarin && 'e.mandarin')
  || (params.q_ja && 'e.ja')
  || null
```

- [ ] **Step 5: Add tier ordering for latn_norm queries**

After the `primaryField` assignment, add a function to build the tier CASE WHEN expression. Use the same interpolation pattern as existing `boostParts` (line 86):

```typescript
const latnCandidates = params.q_puj
  ? normalizeToLatnNorm(params.q_puj, 'puj')
  : params.q_dp
    ? normalizeToLatnNorm(params.q_dp, 'dp')
    : []

const latnRawField = params.q_puj ? 'e.puj' : params.q_dp ? 'e.dp' : null
const latnRawInput = params.q_puj ?? params.q_dp ?? ''

let tierExpr = '0'
if (latnCandidates.length > 0 && latnRawField) {
  const esc = (s: string) => s.replace(/[%_\\']/g, '\\$&')
  const parts: string[] = []
  for (const c of latnCandidates) {
    parts.push(`e.latn_norm = '${esc(c)}'`)
  }
  const exact = parts.join(' OR ')

  const prefixParts = latnCandidates.map((c) => `e.latn_norm LIKE '${esc(c)}%' ESCAPE '\\'`)
  const prefix = prefixParts.join(' OR ')

  const subParts = latnCandidates.map((c) => `e.latn_norm LIKE '%${esc(c)}%' ESCAPE '\\'`)
  const sub = subParts.join(' OR ')

  tierExpr = `CASE WHEN ${exact} THEN 0 WHEN ${prefix} THEN 1 WHEN ${sub} THEN 2 WHEN ${latnRawField} LIKE '%${esc(latnRawInput)}%' ESCAPE '\\' THEN 3 ELSE 4 END`
}
```

- [ ] **Step 6: Integrate tierExpr into relevanceOrder**

Replace the existing `boostParts`/`relevanceOrder` block (lines 84-89):

```typescript
const boostParts: string[] = []
if (origHan && origHan !== q_han && primaryField) {
  boostParts.push(`CASE WHEN ${primaryField} LIKE '%${escLike(origHan)}%' ESCAPE '\\' THEN 0 ELSE 1 END`)
}
if (primaryField) boostParts.push(`LENGTH(${primaryField})`)
const relevanceOrder = boostParts.length > 0 ? boostParts.join(', ') : '0'
```

With:

```typescript
const boostParts: string[] = []
if (tierExpr !== '0') {
  boostParts.push(tierExpr)
} else if (origHan && origHan !== q_han && primaryField) {
  boostParts.push(`CASE WHEN ${primaryField} LIKE '%${escLike(origHan)}%' ESCAPE '\\' THEN 0 ELSE 1 END`)
}
if (primaryField) boostParts.push(`LENGTH(COALESCE(${primaryField}, ''))`)
const relevanceOrder = boostParts.length > 0 ? boostParts.join(', ') : '0'
```

- [ ] **Step 7: Update the in-memory sort for multi-source path**

Find the in-memory sort (around lines 118-124):

```typescript
allEntries.sort((a, b) => {
  const la = primaryField ? (a[primaryField.replace('e.', '')] || '').length : 0
  const lb = primaryField ? (b[primaryField.replace('e.', '')] || '').length : 0
  if (la !== lb) return la - lb
  return a.source_id - b.source_id || a.sort_order - b.sort_order
})
```

This is a secondary sort for the no-source_id path. The SQL already handles tier ordering per-source. Leave this as-is — the per-source SQL ORDER BY already includes the tier CASE WHEN. The in-memory sort just merges sources.

- [ ] **Step 8: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Verify build**

Run: `cd backend && npx wrangler build`
Expected: build succeeds

- [ ] **Step 10: Commit**

```bash
git add backend/src/server/services/search.ts
git commit -m "feat: integrate latn_norm matching with tier ordering in search"
```

---

### Task 5: Data Pipeline — sync-source.py

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add latn_norm generation in parse_csv**

At the top of the file, `sys` is already imported (line 6). In `parse_csv()` (around line 98-106), add `hw_path` parameter and latn_norm generation:

```python
def parse_csv(csv_path, hw_path=None):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row["_section"] = parse_section(row.get("source", ""))
            page_num = row.get("page_num", "").strip()
            row["_page_num"] = int(page_num) if page_num else None
            rows.append(row)

    if hw_path:
        _sys.path.insert(0, str(hw_path))
        from scripts.latn import create_translator
        puj_to_norm = create_translator("PUJ", "LATN_NORM")
        dp_to_norm = create_translator("DP", "LATN_NORM")
        for row in rows:
            puj = row.get("puj")
            dp = row.get("dp")
            if puj:
                row["latn_norm"] = puj_to_norm.translate(puj)
            elif dp:
                row["latn_norm"] = dp_to_norm.translate(dp)

    return rows
```

- [ ] **Step 2: Update all parse_csv call sites to pass hw_path**

`sync_entries_phase` calls `parse_csv`. Update its signature (around line 502):

```python
def sync_entries_phase(cur, source_id, csv_path, changed_page_nums, threshold, hw_path=None):
    csv_rows = parse_csv(csv_path, hw_path=hw_path)
```

Update the local-path call in `main()` (around line 704):

```python
entries_stmts = sync_entries_phase(
    cur, args.source_id, csv_path, entries_changed, args.match_threshold,
    hw_path=str(hw),
)
```

Update the remote-path call to `parse_csv` (around line 638):

```python
csv_rows = parse_csv(csv_path, hw_path=str(hw))
```

- [ ] **Step 3: Update MATCH_FIELDS**

Around line 42-49, add latn_norm:

```python
MATCH_FIELDS = [
    ("han", 2.0),
    ("han_orig", 2.0),
    ("puj", 2.0),
    ("puj_orig", 2.0),
    ("en", 2.0),
    ("en_orig", 2.0),
    ("latn_norm", 2.0),
]
```

- [ ] **Step 4: Update db_entries_by_page SELECT**

Around line 300, add `e.latn_norm`:

```python
cur.execute(
    f"SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
    f"e.latn_norm, e.page_num, s.title "
    f"FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
    f"WHERE e.source_id = ? AND e.page_num IN ({placeholders})",
    (source_id, *page_nums),
)
```

And the non-page-filtered version (around line 307):

```python
cur.execute(
    "SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
    "e.latn_norm, e.page_num, s.title "
    "FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
    "WHERE e.source_id = ?",
    (source_id,),
)
```

And update the row mapping (around line 316):

```python
rows.append({
    "id": r[0],
    "han": r[1] or "",
    "puj": r[2] or "",
    "en": r[3] or "",
    "han_orig": r[4] or "",
    "puj_orig": r[5] or "",
    "en_orig": r[6] or "",
    "latn_norm": r[7] or "",
    "_page_num": r[8],
    "_section": r[9] or "",
})
```

- [ ] **Step 5: Update db_entries_remote SELECT**

Around line 564-567:

```python
sql = (
    "SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
    "e.latn_norm, e.page_num, s.title as section_title "
    "FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
    f"WHERE e.source_id = {source_id} {where};"
)
```

And the result mapping (around line 573):

```python
result.append({
    "id": r["id"],
    "han": r.get("han") or "",
    "puj": r.get("puj") or "",
    "en": r.get("en") or "",
    "han_orig": r.get("han_orig") or "",
    "puj_orig": r.get("puj_orig") or "",
    "en_orig": r.get("en_orig") or "",
    "latn_norm": r.get("latn_norm") or "",
    "_page_num": r.get("page_num"),
    "_section": r.get("section_title") or "",
})
```

- [ ] **Step 6: Update generate_clean_entries_sql INSERT**

Around line 363-369, add `latn_norm` and `dp`:

```python
stmts.append(
    f"INSERT INTO entries "
    f"(source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
    f"VALUES ({source_id}, {section_subquery(source_id, title)}, "
    f"{sql_val(csv_row.get('han'))}, {sql_val(csv_row.get('puj'))}, "
    f"{sql_val(csv_row.get('dp'))}, {sql_val(csv_row.get('latn_norm'))}, "
    f"{sql_val(csv_row.get('en'))}, {sql_val(csv_row.get('han_orig'))}, "
    f"{sql_val(csv_row.get('puj_orig'))}, {sql_val(csv_row.get('en_orig'))}, "
    f"{sql_num(csv_row.get('page_num'))}, 0);"
)
```

- [ ] **Step 7: Update generate_entries_sql INSERT and UPDATE**

In the INSERT block (around line 396-405):

```python
stmts.append(
    f"INSERT INTO entries "
    f"(source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
    f"VALUES ({source_id}, {section_subquery(source_id, title)}, "
    f"{sql_val(csv_row.get('han'))}, {sql_val(csv_row.get('puj'))}, "
    f"{sql_val(csv_row.get('dp'))}, {sql_val(csv_row.get('latn_norm'))}, "
    f"{sql_val(csv_row.get('en'))}, {sql_val(csv_row.get('han_orig'))}, "
    f"{sql_val(csv_row.get('puj_orig'))}, {sql_val(csv_row.get('en_orig'))}, "
    f"{sql_num(csv_row.get('page_num'))}, 0);"
)
```

In the UPDATE block (around line 410-419):

```python
stmts.append(
    f"UPDATE entries SET "
    f"han = {sql_val(csv_row.get('han'))}, "
    f"puj = {sql_val(csv_row.get('puj'))}, "
    f"dp = {sql_val(csv_row.get('dp'))}, "
    f"latn_norm = {sql_val(csv_row.get('latn_norm'))}, "
    f"en = {sql_val(csv_row.get('en'))}, "
    f"han_orig = {sql_val(csv_row.get('han_orig'))}, "
    f"puj_orig = {sql_val(csv_row.get('puj_orig'))}, "
    f"en_orig = {sql_val(csv_row.get('en_orig'))}, "
    f"page_num = {sql_num(csv_row.get('page_num'))}, "
    f"section_id = {section_subquery(source_id, title)} "
    f"WHERE id = {db_row['id']};"
)
```

- [ ] **Step 8: Commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: generate latn_norm and sync dp in sync-source.py"
```

---

### Task 6: Data Pipeline — sql-gen.mjs + full-sync.py

**Files:**
- Modify: `scripts/lib/sql-gen.mjs`
- Modify: `scripts/full-sync.py`

- [ ] **Step 1: Update sql-gen.mjs INSERT**

In `generateSql()`, update the INSERT statement (around line 29) to add `dp` and `latn_norm`:

```javascript
statements.push(
  `INSERT INTO entries (source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order) VALUES (${sourceId}, ${sectionSubquery(sectionTitle)}, ${sqlVal(row.han)}, ${sqlVal(row.puj)}, ${sqlVal(row.dp)}, ${sqlVal(row.latn_norm)}, ${sqlVal(row.en)}, ${sqlVal(row.han_orig)}, ${sqlVal(row.puj_orig)}, ${sqlVal(row.en_orig)}, ${sqlNum(row.page_num)}, 0);`
)
```

Update the UPDATE statement (around line 36) similarly:

```javascript
statements.push(
  `UPDATE entries SET han = ${sqlVal(row.han)}, puj = ${sqlVal(row.puj)}, dp = ${sqlVal(row.dp)}, latn_norm = ${sqlVal(row.latn_norm)}, en = ${sqlVal(row.en)}, han_orig = ${sqlVal(row.han_orig)}, puj_orig = ${sqlVal(row.puj_orig)}, en_orig = ${sqlVal(row.en_orig)}, page_num = ${sqlNum(row.page_num)}, section_id = ${sectionSubquery(sectionTitle)} WHERE source_id = ${sourceId} AND puj = ${sqlVal(row.puj)} AND han = ${sqlVal(row.han)} AND en = ${sqlVal(row.en)};`
)
```

- [ ] **Step 2: Update full-sync.py INSERT**

In `sync_entries()` (around line 72-87), update the INSERT statement:

```python
cur.execute(
    "INSERT INTO entries (source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    (
        source_id,
        section_id,
        row.get("han") or None,
        row.get("puj") or None,
        row.get("dp") or None,
        row.get("latn_norm") or None,
        row.get("en") or None,
        row.get("han_orig") or None,
        row.get("puj_orig") or None,
        row.get("en_orig") or None,
        page_num_int,
        0,
    ),
)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/sql-gen.mjs scripts/full-sync.py
git commit -m "feat: add latn_norm/dp fields to sql-gen.mjs and full-sync.py"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run normalizer tests**

Run: `cd backend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 2: Typecheck backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Build backend**

Run: `cd backend && npx wrangler build`
Expected: build succeeds

- [ ] **Step 4: Build frontend (verify no breakage)**

Run: `./build.sh`
Expected: build succeeds

- [ ] **Step 5: Start dev server and manual test**

Run: `./dev.sh`

Test the following searches via the web UI or API:
- PUJ field: `tsa5` → should find entries with PUJ `tsâ`
- PUJ field: `chin5` → should find entries with PUJ `chîn`
- DP field: `zang1` → should find entries (via latn_norm matching)
- Han field: `時` → should still work (regression check)
- English field: `time` → should still work (regression check)

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: verification complete"
```
