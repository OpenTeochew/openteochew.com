# Mandarin English Bridge Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mandarin fallback search that maps a Chinese query through a zh-TW→English dictionary, then searches Teochew entries by English when direct Mandarin search has no results.

**Architecture:** Keep the existing `searchEntries()` API surface and add a focused bridge path inside the backend search service. Add a D1 table for `zh_en_dict`, a sync script for importing `zh-TW,en,pos`, and tests around direct-first, simplified-to-traditional, and bridge fallback behavior.

**Tech Stack:** TypeScript, Hono, Cloudflare D1, SQLite-compatible SQL, Vitest, Python CSV import script, OpenCC.

---

## File Structure

- Create `scripts/006_add_zh_en_dict.sql`: D1 schema migration for the bridge dictionary.
- Create `scripts/sync-zh-en-dict.py`: imports `tmp/zh-TW_en_dict.csv` into local SQLite or remote D1.
- Create `scripts/sync-zh-en-dict.sh`: shell wrapper matching existing sync script style.
- Modify `backend/src/server/services/search.ts`: direct-first Mandarin search, bridge candidate lookup, bridge entry search, `match_meta` return.
- Create `backend/src/server/services/search.test.ts`: unit tests using a small fake D1 database.
- Modify `web/src/types/search.ts`: add optional `match_meta` result typing.
- Keep `docs/superpowers/specs/2026-06-27-mandarin-english-bridge-search-design.md` as the design source.

## Task 1: Schema migration

**Files:**
- Create: `scripts/006_add_zh_en_dict.sql`

- [ ] **Step 1: Create migration**

```sql
CREATE TABLE IF NOT EXISTS zh_en_dict (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zh_tw TEXT NOT NULL,
  en TEXT NOT NULL,
  pos TEXT
);

CREATE INDEX IF NOT EXISTS idx_zh_en_dict_zh_tw ON zh_en_dict(zh_tw);
CREATE INDEX IF NOT EXISTS idx_zh_en_dict_en ON zh_en_dict(en);
```

- [ ] **Step 2: Verify migration applies locally**

Run:

```bash
sqlite3 /tmp/openteochew_zh_en_schema_test.db < scripts/001_initial_schema.sql
sqlite3 /tmp/openteochew_zh_en_schema_test.db < scripts/003_add_latn_norm.sql
sqlite3 /tmp/openteochew_zh_en_schema_test.db < scripts/004_add_scan_source.sql
sqlite3 /tmp/openteochew_zh_en_schema_test.db < scripts/005_add_publisher.sql
sqlite3 /tmp/openteochew_zh_en_schema_test.db < scripts/006_add_zh_en_dict.sql
sqlite3 /tmp/openteochew_zh_en_schema_test.db ".schema zh_en_dict"
```

Expected: schema includes `zh_tw`, `en`, `pos`, and both indexes.

## Task 2: Dictionary sync script

**Files:**
- Create: `scripts/sync-zh-en-dict.py`
- Create: `scripts/sync-zh-en-dict.sh`

- [ ] **Step 1: Write `sync-zh-en-dict.py`**

Create a Python script with:

```python
#!/usr/bin/env python3
import argparse
import csv
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DB = REPO / "tmp" / "openteochew.db"
WRANGLER_DB_DIR = REPO / "backend" / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
D1_NAME = "openteochew-db-dev"
BATCH_SIZE = 2000
REQUIRED_COLUMNS = ["zh-TW", "en", "pos"]


def find_db():
    if DEFAULT_DB.exists():
        return DEFAULT_DB
    if WRANGLER_DB_DIR.is_dir():
        for f in WRANGLER_DB_DIR.glob("*.sqlite"):
            if f.name != "metadata.sqlite":
                return f
    print("ERROR: local D1 database not found. Run `./scripts/init_dev_db.sh` first.", file=sys.stderr)
    sys.exit(1)


def sql_escape(s):
    return s.replace("'", "''") if s else s


def sql_val(s):
    if s is None or s == "":
        return "NULL"
    return f"'{sql_escape(s)}'"


def parse_csv(path):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [col for col in REQUIRED_COLUMNS if col not in (reader.fieldnames or [])]
        if missing:
            print(f"ERROR: CSV missing columns: {', '.join(missing)}", file=sys.stderr)
            sys.exit(1)
        for row in reader:
            zh_tw = (row.get("zh-TW") or "").strip()
            en = (row.get("en") or "").strip()
            pos = (row.get("pos") or "").strip()
            if not zh_tw or not en:
                continue
            rows.append({"zh_tw": zh_tw, "en": en, "pos": pos})
    return rows


def generate_sql(rows):
    statements = ["DELETE FROM zh_en_dict;"]
    for row in rows:
        statements.append(
            "INSERT INTO zh_en_dict (zh_tw, en, pos) VALUES "
            f"({sql_val(row['zh_tw'])}, {sql_val(row['en'])}, {sql_val(row['pos'])});"
        )
    return statements


def execute_local(db_path, statements):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    try:
        for stmt in statements:
            cur.execute(stmt)
        con.commit()
        print(f"  executed {len(statements)} statements on local DB")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def execute_remote(statements):
    tmp_path = None
    try:
        for i in range(0, len(statements), BATCH_SIZE):
            batch = statements[i:i + BATCH_SIZE]
            with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as f:
                f.write("\n".join(batch))
                tmp_path = f.name
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(statements) + BATCH_SIZE - 1) // BATCH_SIZE
            print(f"  executing batch {batch_num}/{total_batches} ({len(batch)} statements)...")
            subprocess.run(
                ["npx", "--yes", "wrangler", "d1", "execute", D1_NAME, "--remote", "--yes", f"--file={tmp_path}"],
                check=True, cwd=REPO,
            )
            Path(tmp_path).unlink(missing_ok=True)
            tmp_path = None
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Sync zh-TW to English dictionary into D1")
    parser.add_argument("--csv", type=Path, default=REPO / "tmp" / "zh-TW_en_dict.csv")
    parser.add_argument("--local", action="store_true", help="sync to local SQLite (default)")
    parser.add_argument("--remote", action="store_true", help="sync to remote D1 via wrangler")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"ERROR: CSV not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    rows = parse_csv(args.csv)
    statements = generate_sql(rows)
    print(f"sync zh_en_dict: {len(rows)} rows")

    if args.remote:
        execute_remote(statements)
    else:
        execute_local(find_db(), statements)

    print("sync complete.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write `sync-zh-en-dict.sh`**

```bash
#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR

usage() {
  cat <<EOF
Usage: $0 [--local|--remote] [--csv PATH]

Sync zh-TW to English dictionary CSV to D1.

Modes:
  --local           Sync to local D1 (default)
  --remote          Sync to remote D1 via wrangler

Options:
  --csv PATH        CSV path (default: tmp/zh-TW_en_dict.csv)
  -h, --help        Show this help
EOF
}

MODE="--local"
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --local|--remote)
      MODE="$1"
      shift
      ;;
    --csv)
      EXTRA_ARGS+=("$1" "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$MODE" = "--remote" ]; then
  ENV_FILE="$ROOT/../.env.dev"
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found (required for --remote)" >&2
    exit 1
  fi
  set -a
  source "$ENV_FILE"
  set +a
fi

cd "$ROOT/.."
python3 scripts/sync-zh-en-dict.py "$MODE" "${EXTRA_ARGS[@]}"
```

- [ ] **Step 3: Make shell script executable**

Run:

```bash
chmod +x scripts/sync-zh-en-dict.sh scripts/sync-zh-en-dict.py
```

Expected: no output.

## Task 3: Backend tests for bridge search

**Files:**
- Create: `backend/src/server/services/search.test.ts`

- [ ] **Step 1: Add fake D1 test harness**

Create tests that implement a minimal D1 fake with `.prepare(sql).bind(...values).first()` and `.all()` backed by deterministic fixtures.

Test cases:

1. direct Mandarin result returns `match_meta.mode = 'direct'` and does not query `zh_en_dict`
2. simplified query `电脑` bridges through dictionary row `電腦 -> computer`
3. bridge uses at most 5 unique English candidates
4. no direct and no dictionary candidate returns empty result with `mode = 'mandarin_bridge'` and empty `bridge_terms`

- [ ] **Step 2: Run tests to verify they fail before implementation**

Run:

```bash
cd backend && npm test -- src/server/services/search.test.ts
```

Expected: FAIL because `match_meta` and bridge behavior are not implemented.

## Task 4: Backend implementation

**Files:**
- Modify: `backend/src/server/services/search.ts`

- [ ] **Step 1: Refactor params type**

Add a local `SearchParams` type matching the current inline param object.

- [ ] **Step 2: Add helper for unique query variants**

Implement:

```ts
function uniqueTerms(...terms: Array<string | undefined>): string[] {
  return [...new Set(terms.filter((term): term is string => Boolean(term)))]
}
```

- [ ] **Step 3: Add bridge candidate lookup**

Implement a helper:

```ts
async function findMandarinBridgeTerms(db: D1Database, terms: string[], limit = 5): Promise<string[]> {
  if (terms.length === 0) return []
  const conditions: string[] = []
  const values: string[] = []
  for (const term of terms) {
    conditions.push('zh_tw LIKE ?')
    values.push(`%${term}%`)
  }
  const exactCases = terms.map((term) => `WHEN zh_tw = '${term.replace(/'/g, "''")}' THEN 0`).join(' ')
  const prefixCases = terms.map((term) => `WHEN zh_tw LIKE '${term.replace(/[%_\\']/g, '\\$&')}%' ESCAPE '\\' THEN 1`).join(' ')
  const sql = `SELECT en FROM zh_en_dict WHERE ${conditions.join(' OR ')} ORDER BY CASE ${exactCases} ${prefixCases} ELSE 2 END, LENGTH(zh_tw), id LIMIT 50`
  const rows = await db.prepare(sql).bind(...values).all()
  const result: string[] = []
  for (const row of rows.results as Array<{ en?: string }>) {
    const en = row.en?.trim()
    if (en && !result.includes(en)) result.push(en)
    if (result.length >= limit) break
  }
  return result
}
```

- [ ] **Step 4: Add internal search mode support**

Allow `searchEntries()` to run direct Mandarin first. If the original params contain `q_mandarin` and direct total is zero, call `findMandarinBridgeTerms()` and run the existing search body with `q_en` conditions for those candidate terms.

- [ ] **Step 5: Return match metadata**

Return:

```ts
match_meta: {
  mode: 'direct' as const,
}
```

for normal direct results when `q_mandarin` is present, and:

```ts
match_meta: {
  mode: 'mandarin_bridge' as const,
  bridge_terms: bridgeTerms,
}
```

for fallback results.

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd backend && npm test -- src/server/services/search.test.ts
```

Expected: PASS.

## Task 5: Frontend type update

**Files:**
- Modify: `web/src/types/search.ts`

- [ ] **Step 1: Add optional match metadata type**

Add:

```ts
export interface SearchMatchMeta {
  mode: 'direct' | 'mandarin_bridge'
  bridge_terms?: string[]
}
```

Update `SearchResult`:

```ts
export interface SearchResult {
  total: number
  page: number
  groups: SearchGroup[]
  match_meta?: SearchMatchMeta
}
```

- [ ] **Step 2: Typecheck via build**

Run project build command after all tasks.

## Task 6: Local data sync and verification

**Files:**
- Uses: `scripts/init_dev_db.sh`
- Uses: `scripts/sync-zh-en-dict.sh`

- [ ] **Step 1: Rebuild local DB**

Run:

```bash
./scripts/init_dev_db.sh
```

Expected: local DB exists at `tmp/openteochew.db`.

- [ ] **Step 2: Import dictionary**

Run:

```bash
./scripts/sync-zh-en-dict.sh --local
```

Expected: imports rows from `tmp/zh-TW_en_dict.csv`.

- [ ] **Step 3: Verify dictionary row count**

Run:

```bash
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM zh_en_dict;"
```

Expected: count greater than 0.

- [ ] **Step 4: Run targeted backend tests**

Run:

```bash
cd backend && npm test -- src/server/services/search.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full backend tests**

Run:

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] **Step 6: Run backend build/typecheck**

Run:

```bash
cd backend && npm run build
```

Expected: PASS.

- [ ] **Step 7: Run full project build**

Run:

```bash
./build.sh
```

Expected: PASS.

## Self-Review

- Spec coverage: schema, CSV import, direct-first Mandarin search, simplified-to-traditional handling, bridge candidate limit, API metadata, and local verification are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `match_meta`, `mode`, `bridge_terms`, `zh_tw`, `en`, and `pos` names match the design spec.
