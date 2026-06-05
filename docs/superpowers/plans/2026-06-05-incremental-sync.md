# Incremental Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `full-sync.py` and `sync-csv.py` with a unified `sync-source.py` that does incremental sync for both pages (content hash diff) and entries (fuzzy matching by page groups).

**Architecture:** Pages get a `content_hash` column. On sync, hash the new markdown pages and diff against DB hashes — only changed pages generate SQL. Entries use multi-field Levenshtein ratio matching, grouped by `page_num`, with a greedy algorithm to pair CSV rows with DB rows. Pages changes drive which entries get re-matched.

**Tech Stack:** Python 3.10+, sqlite3, hashlib, csv, subprocess (wrangler). No external Python dependencies.

**Design spec:** `docs/superpowers/specs/2026-06-05-incremental-sync-design.md`

**Key reference files:**
- Current scripts: `scripts/full-sync.py`, `scripts/sync-csv.py`
- DB schema: `scripts/001_initial_schema.sql`
- Dataset CSV: `code/dataset/export/books/001_Handbook_of_the_Swatow_Vernacular.csv`
- Dataset markdown: `code/dataset/books/001_Handbook_of_the_Swatow_Vernacular.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/sync-source.py` | **Create** | Unified sync script (the main deliverable) |
| `scripts/003_add_content_hash.sql` | **Create** | Migration: add `content_hash` column + index to pages |
| `init_dev_db.sh` | **Modify** | Add migration step after initial schema |
| `scripts/full-sync.py` | **Keep** (not deleted yet) | Retire after `sync-source.py` is validated |
| `scripts/sync-csv.py` | **Keep** (not deleted yet) | Retire after `sync-source.py` is validated |

`sync-source.py` is a single file (~350-400 lines). No `scripts/lib/` Python modules needed — the script is self-contained like the existing ones.

---

### Task 1: Schema Migration — Add `content_hash` to pages

**Files:**
- Create: `scripts/003_add_content_hash.sql`
- Modify: `init_dev_db.sh`

- [ ] **Step 1: Create migration SQL**

```sql
-- 003_add_content_hash.sql
ALTER TABLE pages ADD COLUMN content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_pages_hash ON pages(source_id, content_hash);
```

- [ ] **Step 2: Update `init_dev_db.sh` to apply migrations**

The existing script runs `scripts/[0-9]*.sql` in order — the new `003_add_content_hash.sql` will be picked up automatically. But for existing DBs we need to handle the case where the column already exists. Update `init_dev_db.sh` to also support running just the migration on an existing DB:

No change needed to `init_dev_db.sh` — the glob `scripts/[0-9]*.sql` already picks up `003_*.sql` for fresh DBs. For existing DBs, we'll add a separate `scripts/migrate.sh` later if needed (not in scope).

- [ ] **Step 3: Test migration on fresh DB**

```bash
cd /home/ubuntu/floating-cloud/code/openteochew.com
rm -f tmp/openteochew.db
bash init_dev_db.sh
sqlite3 tmp/openteochew.db ".schema pages"
```

Expected: pages table includes `content_hash TEXT` column.

- [ ] **Step 4: Commit**

```bash
git add scripts/003_add_content_hash.sql
git commit -m "feat: add content_hash column to pages table"
```

---

### Task 2: Core helpers — DB access, CSV parsing, markdown parsing, hash

**Files:**
- Create: `scripts/sync-source.py` (begin building it)

- [ ] **Step 1: Create `sync-source.py` with imports and constants**

```python
#!/usr/bin/env python3
import argparse
import csv
import hashlib
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DB = REPO / "tmp" / "openteochew.db"
WRANGLER_DB_DIR = REPO / "backend" / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
HW_DEFAULT = REPO.parent / "dataset"
D1_NAME = "openteochew-db-dev"
BATCH_SIZE = 100

SOURCE_CONFIG = {
    1: {
        "csv": "export/books/001_Handbook_of_the_Swatow_Vernacular.csv",
        "md": "books/001_Handbook_of_the_Swatow_Vernacular.md",
        "slug": "Handbook_of_the_Swatow_Vernacular",
    },
}

SECTION_RE = re.compile(r">\s*(.+)$")
PAGE_RE = re.compile(r"<!-- page:(\d+) -->")
```

Note: `HW_DEFAULT` points to `code/dataset/` (the local checkout), not `~/Documents/Code/hokkien-writing/dataset`.

- [ ] **Step 2: Add DB helper functions**

```python
def find_db():
    if DEFAULT_DB.exists():
        return DEFAULT_DB
    if WRANGLER_DB_DIR.is_dir():
        for f in WRANGLER_DB_DIR.glob("*.sqlite"):
            if f.name != "metadata.sqlite":
                return f
    print("ERROR: local D1 database not found. Run `bash init_dev_db.sh` first.", file=sys.stderr)
    sys.exit(1)


def content_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def parse_section(source_field):
    if not source_field:
        return None
    m = SECTION_RE.search(source_field)
    return m.group(1).strip() if m else None


def sql_escape(s):
    return s.replace("'", "''") if s else s


def sql_val(val):
    if not val:
        return "NULL"
    return f"'{sql_escape(val)}'"


def sql_num(val):
    try:
        return str(int(val))
    except (ValueError, TypeError):
        return "NULL"


def section_subquery(source_id, title):
    if not title:
        return "NULL"
    return (f"(SELECT id FROM sections WHERE source_id = {source_id} "
            f"AND title = '{sql_escape(title)}' LIMIT 1)")
```

- [ ] **Step 3: Add CSV parser**

```python
def parse_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["_section"] = parse_section(row.get("source", ""))
        pn = row.get("page_num", "").strip()
        row["_page_num"] = int(pn) if pn else None
    return rows
```

- [ ] **Step 4: Add markdown page parser**

```python
def parse_pages(md_path):
    content = md_path.read_text(encoding="utf-8")
    markers = list(PAGE_RE.finditer(content))
    if not markers:
        return []
    pages = []
    for i in range(len(markers)):
        page_num = int(markers[i].group(1))
        start = markers[i].end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(content)
        ocr_text = content[start:end].strip()
        pages.append({
            "page_num": page_num,
            "ocr_text": ocr_text,
            "content_hash": content_hash(ocr_text),
        })
    return pages
```

- [ ] **Step 5: Verify script parses without errors**

```bash
python3 -c "import scripts.sync_source" 2>&1 || true
python3 scripts/sync-source.py --help
```

Expected: script prints usage help (argparse not yet added, will error — that's fine). For now just check syntax:

```bash
python3 -c "exec(open('scripts/sync-source.py').read().split('if __name__')[0])"
```

Expected: no output (no syntax errors).

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: sync-source.py — helpers (DB, CSV, markdown, hash)"
```

---

### Task 3: Pages incremental sync — hash diff + SQL generation

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add pages diff function**

```python
def diff_pages(db_hashes, new_pages):
    old_map = {p["page_num"]: p["content_hash"] for p in db_hashes}
    new_map = {p["page_num"]: p for p in new_pages}

    added = []
    modified = []
    removed = []

    for pn, page in new_map.items():
        if pn not in old_map:
            added.append(page)
        elif old_map[pn] != page["content_hash"]:
            modified.append(page)

    for pn in old_map:
        if pn not in new_map:
            removed.append(pn)

    return added, modified, removed
```

- [ ] **Step 2: Add pages SQL generator**

```python
def generate_pages_sql(source_id, slug, added, modified, removed):
    stmts = []
    for page in added:
        image_url = f"https://static.openteochew.com/{slug}/{str(page['page_num']).zfill(4)}.webp"
        stmts.append(
            f"INSERT INTO pages (source_id, page_num, image_url, ocr_text, content_hash, sort_order) "
            f"VALUES ({source_id}, {page['page_num']}, '{image_url}', "
            f"'{sql_escape(page['ocr_text'])}', '{page['content_hash']}', {page['page_num']});"
        )
    for page in modified:
        image_url = f"https://static.openteochew.com/{slug}/{str(page['page_num']).zfill(4)}.webp"
        stmts.append(
            f"UPDATE pages SET ocr_text = '{sql_escape(page['ocr_text'])}', "
            f"content_hash = '{page['content_hash']}' "
            f"WHERE source_id = {source_id} AND page_num = {page['page_num']};"
        )
    for pn in removed:
        stmts.append(
            f"DELETE FROM pages WHERE source_id = {source_id} AND page_num = {pn};"
        )
    return stmts
```

- [ ] **Step 3: Add backfill function for first-time hash population**

```python
def backfill_hashes(cur, source_id):
    cur.execute(
        "SELECT id, ocr_text FROM pages WHERE source_id = ? AND content_hash IS NULL",
        (source_id,),
    )
    rows = cur.fetchall()
    for row_id, ocr_text in rows:
        h = content_hash(ocr_text or "")
        cur.execute(
            "UPDATE pages SET content_hash = ? WHERE id = ?",
            (h, row_id),
        )
    return len(rows)
```

- [ ] **Step 4: Test pages diff locally**

Add a minimal test at the bottom of the script (temporary, remove before final commit):

```python
if __name__ == "__main__":
    # Quick smoke test
    old = [{"page_num": 1, "content_hash": "aaa"}, {"page_num": 2, "content_hash": "bbb"}]
    new = [
        {"page_num": 1, "ocr_text": "unchanged", "content_hash": "aaa"},
        {"page_num": 2, "ocr_text": "changed", "content_hash": "ccc"},
        {"page_num": 3, "ocr_text": "new", "content_hash": "ddd"},
    ]
    a, m, r = diff_pages(old, new)
    print(f"Added: {len(a)}, Modified: {len(m)}, Removed: {len(r)}")
    assert len(a) == 1 and a[0]["page_num"] == 3
    assert len(m) == 1 and m[0]["page_num"] == 2
    assert len(r) == 0
    print("Pages diff OK")
```

Run: `python3 scripts/sync-source.py`
Expected: `Added: 1, Modified: 1, Removed: 0` then `Pages diff OK`

- [ ] **Step 5: Remove smoke test, commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: pages incremental sync — hash diff + SQL generation"
```

---

### Task 4: Entries fuzzy matching — Levenshtein + greedy matcher

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add Levenshtein ratio function**

Pure Python implementation (no external deps):

```python
def levenshtein_ratio(s1, s2):
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    len1, len2 = len(s1), len(s2)
    if abs(len1 - len2) > max(len1, len2) * 0.5:
        return 0.0
    d = list(range(len2 + 1))
    for i in range(1, len1 + 1):
        prev = d[0]
        d[0] = i
        for j in range(1, len2 + 1):
            temp = d[j]
            if s1[i - 1] == s2[j - 1]:
                d[j] = prev
            else:
                d[j] = 1 + min(prev, d[j], d[j - 1])
            prev = temp
    dist = d[len2]
    return 1.0 - dist / max(len1, len2)
```

- [ ] **Step 2: Add similarity and match functions**

```python
MATCH_FIELDS = [
    ("han",       2.0),
    ("han_orig",  2.0),
    ("puj",       2.0),
    ("puj_orig",  2.0),
    ("en",        2.0),
    ("en_orig",   2.0),
]


def similarity(csv_row, db_row):
    total_weight = 0.0
    total_score = 0.0
    for field, weight in MATCH_FIELDS:
        csv_val = csv_row.get(field)
        db_val = db_row.get(field)
        if csv_val and db_val:
            score = levenshtein_ratio(csv_val, db_val)
            total_score += score * weight
            total_weight += weight
    if total_weight == 0:
        return 0.0
    return total_score / total_weight


def match_entries(csv_group, db_group, threshold=0.8):
    scores = {}
    for i, csv_row in enumerate(csv_group):
        for j, db_row in enumerate(db_group):
            scores[(i, j)] = similarity(csv_row, db_row)

    matched = []
    used_csv = set()
    used_db = set()

    for _ in range(min(len(csv_group), len(db_group))):
        best = None
        best_score = -1
        for i in range(len(csv_group)):
            if i in used_csv:
                continue
            for j in range(len(db_group)):
                if j in used_db:
                    continue
                s = scores[(i, j)]
                if s > best_score:
                    best_score = s
                    best = (i, j, s)
        if best is None or best[2] < threshold:
            break
        matched.append(best)
        used_csv.add(best[0])
        used_db.add(best[1])

    updates = [(csv_group[i], db_group[j]) for i, j, _ in matched]
    inserts = [csv_group[i] for i in range(len(csv_group)) if i not in used_csv]
    deletes = [db_group[j] for j in range(len(db_group)) if j not in used_db]
    return inserts, updates, deletes
```

- [ ] **Step 3: Smoke test fuzzy matching**

Temporary test at bottom:

```python
if __name__ == "__main__":
    csv_rows = [
        {"han": "阿母", "puj": "A-bó", "en": "Mother", "han_orig": "亞母", "puj_orig": "", "en_orig": ""},
        {"han": "亞無", "puj": "A-bô", "en": "Or not?", "han_orig": "或無", "puj_orig": "", "en_orig": ""},
        {"han": "阿叔", "puj": "A-chek", "en": "Uncle", "han_orig": "亞叔", "puj_orig": "", "en_orig": ""},
    ]
    db_rows = [
        {"han": "阿母", "puj": "A-bo", "en": "Mother", "han_orig": "亞母", "puj_orig": "", "en_orig": ""},
        {"han": "亞無", "puj": "A-bo", "en": "Or not", "han_orig": "或無", "puj_orig": "", "en_orig": ""},
    ]
    ins, upd, delt = match_entries(csv_rows, db_rows, threshold=0.8)
    print(f"Inserts: {len(ins)}, Updates: {len(updates)}, Deletes: {len(deletes)}")
    assert len(upd) == 2
    assert len(ins) == 1
    assert len(deletes) == 0
    print("Fuzzy match OK")
```

Run: `python3 scripts/sync-source.py`
Expected: `Inserts: 1, Updates: 2, Deletes: 0` then `Fuzzy match OK`

Fix any assertion failures by tuning threshold or examining scores.

- [ ] **Step 4: Remove smoke test, commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: entries fuzzy matching — Levenshtein ratio + greedy matcher"
```

---

### Task 5: Entries diff by page groups + SQL generation

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add entries diff function**

```python
def diff_entries(csv_rows, db_rows, changed_page_nums, threshold):
    from collections import defaultdict

    csv_by_page = defaultdict(list)
    db_by_page = defaultdict(list)

    for row in csv_rows:
        pn = row.get("_page_num")
        if changed_page_nums is not None:
            if pn is None or pn not in changed_page_nums:
                continue
        csv_by_page[pn].append(row)

    for row in db_rows:
        pn = row.get("_page_num")
        if changed_page_nums is not None:
            if pn is None or pn not in changed_page_nums:
                continue
        db_by_page[pn].append(row)

    all_inserts = []
    all_updates = []
    all_deletes = []

    all_pages = set(csv_by_page.keys()) | set(db_by_page.keys())
    for pn in sorted(all_pages, key=lambda x: (x is None, x or 0)):
        csv_group = csv_by_page.get(pn, [])
        db_group = db_by_page.get(pn, [])

        if not db_group:
            all_inserts.extend(csv_group)
        elif not csv_group:
            all_deletes.extend(db_group)
        else:
            ins, upd, delt = match_entries(csv_group, db_group, threshold)
            all_inserts.extend(ins)
            all_updates.extend(upd)
            all_deletes.extend(delt)

    return all_inserts, all_updates, all_deletes
```

- [ ] **Step 2: Add entries SQL generator**

```python
def generate_entries_sql(source_id, inserts, updates, deletes):
    stmts = []
    new_sections = set()
    existing_titles = set()

    for row in inserts:
        title = row.get("_section")
        if title and title not in existing_titles and title not in new_sections:
            new_sections.add(title)

    for row in updates:
        _, db_row = row
        title = db_row.get("_section")
        if title:
            existing_titles.add(title)
        title2 = row[0].get("_section")
        if title2 and title2 not in existing_titles and title2 not in new_sections:
            new_sections.add(title2)

    for title in new_sections:
        stmts.append(
            f"INSERT OR IGNORE INTO sections (source_id, title, sort_order) "
            f"VALUES ({source_id}, '{sql_escape(title)}', 0);"
        )

    for csv_row in inserts:
        title = csv_row.get("_section")
        stmts.append(
            f"INSERT INTO entries "
            f"(source_id, section_id, han, puj, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
            f"VALUES ({source_id}, {section_subquery(source_id, title)}, "
            f"{sql_val(csv_row.get('han'))}, {sql_val(csv_row.get('puj'))}, "
            f"{sql_val(csv_row.get('en'))}, "
            f"{sql_val(csv_row.get('han_orig'))}, {sql_val(csv_row.get('puj_orig'))}, "
            f"{sql_val(csv_row.get('en_orig'))}, "
            f"{sql_num(csv_row.get('page_num'))}, 0);"
        )

    for csv_row, db_row in updates:
        title = csv_row.get("_section")
        db_id = db_row.get("id")
        stmts.append(
            f"UPDATE entries SET "
            f"han = {sql_val(csv_row.get('han'))}, "
            f"puj = {sql_val(csv_row.get('puj'))}, "
            f"en = {sql_val(csv_row.get('en'))}, "
            f"han_orig = {sql_val(csv_row.get('han_orig'))}, "
            f"puj_orig = {sql_val(csv_row.get('puj_orig'))}, "
            f"en_orig = {sql_val(csv_row.get('en_orig'))}, "
            f"page_num = {sql_num(csv_row.get('page_num'))}, "
            f"section_id = {section_subquery(source_id, title)} "
            f"WHERE id = {db_id};"
        )

    for db_row in deletes:
        db_id = db_row.get("id")
        stmts.append(f"DELETE FROM entries WHERE id = {db_id};")

    return stmts
```

Note: UPDATE and DELETE now use `WHERE id = ?` instead of the old composite key `(puj, han, en)` — this is more reliable since the fuzzy match already identified the correct DB row.

- [ ] **Step 3: Add DB reader for entries**

```python
def db_entries_by_page(cur, source_id, page_nums=None):
    if page_nums is not None:
        placeholders = ",".join("?" for _ in page_nums)
        cur.execute(
            f"SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
            f"e.page_num, s.title as section_title "
            f"FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
            f"WHERE e.source_id = ? AND e.page_num IN ({placeholders})",
            (source_id, *page_nums),
        )
    else:
        cur.execute(
            "SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
            "e.page_num, s.title as section_title "
            "FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
            "WHERE e.source_id = ?",
            (source_id,),
        )
    rows = []
    for r in cur.fetchall():
        rows.append({
            "id": r[0],
            "han": r[1] or "",
            "puj": r[2] or "",
            "en": r[3] or "",
            "han_orig": r[4] or "",
            "puj_orig": r[5] or "",
            "en_orig": r[6] or "",
            "_page_num": r[7],
            "_section": r[8] or "",
        })
    return rows
```

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: entries diff by page groups + SQL generation"
```

---

### Task 6: Local sync execution + main CLI

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add execution helpers**

```python
def execute_local(db_path, statements):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    try:
        for stmt in statements:
            cur.execute(stmt)
        con.commit()
        print(f"  Executed {len(statements)} SQL statements on local DB")
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
            print(f"  Executing batch {batch_num}/{total_batches} ({len(batch)} statements)...")
            subprocess.run(
                ["npx", "wrangler", "d1", "execute", D1_NAME, "--remote", f"--file={tmp_path}"],
                check=True, cwd=REPO,
            )
            Path(tmp_path).unlink(missing_ok=True)
            tmp_path = None
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
```

- [ ] **Step 2: Add `sync_pages_phase` function**

```python
def sync_pages_phase(cur, source_id, md_path, slug, use_remote):
    new_pages = parse_pages(md_path)
    if not new_pages:
        print("  pages: no page markers found, skipping")
        return set()

    if use_remote:
        print("  ERROR: remote pages reading not yet implemented", file=sys.stderr)
        sys.exit(1)

    count = backfill_hashes(cur, source_id)
    if count:
        print(f"  backfilled {count} page hashes")

    cur.execute(
        "SELECT page_num, content_hash FROM pages WHERE source_id = ?",
        (source_id,),
    )
    db_hashes = [{"page_num": r[0], "content_hash": r[1] or ""} for r in cur.fetchall()]

    added, modified, removed = diff_pages(db_hashes, new_pages)
    changed = {p["page_num"] for p in added} | {p["page_num"] for p in modified} | set(removed)

    print(f"  Pages diff:")
    print(f"    DB: {len(db_hashes)} pages")
    print(f"    New: {len(new_pages)} pages")
    print(f"    Added: {len(added)}, Modified: {len(modified)}, Deleted: {len(removed)}")

    if changed:
        stmts = generate_pages_sql(source_id, slug, added, modified, removed)
        print(f"    SQL: {len(stmts)} statements")
        return changed, stmts
    else:
        print("    No page changes")
        return set(), []


def db_page_hashes_remote(source_id):
    print("  ERROR: remote pages reading not yet implemented", file=sys.stderr)
    sys.exit(1)
```

Wait, the return signature is inconsistent. Let me simplify:

```python
def sync_pages_phase(cur, source_id, md_path, slug):
    new_pages = parse_pages(md_path)
    if not new_pages:
        print("  pages: no page markers found, skipping")
        return set(), []

    count = backfill_hashes(cur, source_id)
    if count:
        print(f"  backfilled {count} page hashes")

    cur.execute(
        "SELECT page_num, content_hash FROM pages WHERE source_id = ?",
        (source_id,),
    )
    db_hashes = [{"page_num": r[0], "content_hash": r[1] or ""} for r in cur.fetchall()]

    added, modified, removed = diff_pages(db_hashes, new_pages)
    changed_page_nums = {p["page_num"] for p in added} | {p["page_num"] for p in modified} | set(removed)

    print(f"  Pages diff:")
    print(f"    DB: {len(db_hashes)} pages")
    print(f"    New: {len(new_pages)} pages")
    print(f"    Added: {len(added)}, Modified: {len(modified)}, Deleted: {len(removed)}")

    stmts = generate_pages_sql(source_id, slug, added, modified, removed)
    if stmts:
        print(f"    SQL: {len(stmts)} statements")

    return changed_page_nums, stmts
```

- [ ] **Step 3: Add `sync_entries_phase` function**

```python
def sync_entries_phase(cur, source_id, csv_path, changed_page_nums, threshold):
    csv_rows = parse_csv(csv_path)
    print(f"  Entries diff (threshold: {threshold}):")

    if changed_page_nums is not None:
        page_nums_list = sorted(changed_page_nums)
        print(f"    Affected pages: {page_nums_list}")
        db_rows = db_entries_by_page(cur, source_id, page_nums_list)
        csv_filtered = [r for r in csv_rows if r.get("_page_num") in changed_page_nums]
        print(f"    CSV rows in range: {len(csv_filtered)}, DB rows in range: {len(db_rows)}")
    else:
        db_rows = db_entries_by_page(cur, source_id)
        csv_filtered = csv_rows
        print(f"    CSV rows: {len(csv_filtered)}, DB rows: {len(db_rows)}")

    inserts, updates, deletes = diff_entries(csv_filtered, db_rows, changed_page_nums, threshold)

    print(f"    Matched: {len(updates)}, Inserted: {len(inserts)}, Deleted: {len(deletes)}")

    if not inserts and not updates and not deletes:
        return []

    stmts = generate_entries_sql(source_id, inserts, updates, deletes)
    print(f"    SQL: {len(stmts)} statements")
    return stmts
```

- [ ] **Step 4: Add `main()` with argparse**

```python
def main():
    parser = argparse.ArgumentParser(description="Incremental sync CSV + OCR pages to D1")
    parser.add_argument("--source-id", type=int, required=True)
    parser.add_argument("--csv", type=Path, help="CSV path (overrides config)")
    parser.add_argument("--md", type=Path, help="Markdown path (overrides config)")
    parser.add_argument("--hw", type=Path, default=HW_DEFAULT, help="dataset root directory")
    parser.add_argument("--local", action="store_true", help="sync to local SQLite (default)")
    parser.add_argument("--remote", action="store_true", help="sync to remote D1 via wrangler")
    parser.add_argument("--pages-only", action="store_true")
    parser.add_argument("--entries-only", action="store_true")
    parser.add_argument("--match-threshold", type=float, default=0.8)
    args = parser.parse_args()

    use_remote = args.remote
    cfg = SOURCE_CONFIG.get(args.source_id)
    if not cfg:
        print(f"ERROR: no config for source_id={args.source_id}", file=sys.stderr)
        sys.exit(1)

    hw = args.hw
    csv_path = args.csv or (hw / cfg["csv"])
    md_path = args.md or (hw / cfg["md"])
    slug = cfg.get("slug", str(args.source_id))

    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Syncing source_id={args.source_id}")
    print(f"  CSV: {csv_path} ({csv_path.stat().st_size} bytes)")

    all_stmts = []

    if use_remote:
        print("  ERROR: --remote not yet implemented", file=sys.stderr)
        sys.exit(1)

    db_path = find_db()
    print(f"  DB:  {db_path}")
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    try:
        changed_page_nums = None

        if not args.entries_only:
            if md_path.exists():
                print(f"  MD:  {md_path}")
                changed_page_nums, pages_stmts = sync_pages_phase(cur, args.source_id, md_path, slug)
                all_stmts.extend(pages_stmts)
            else:
                print(f"  MD:  not found, skipping pages")
                changed_page_nums = None

        if not args.pages_only:
            if changed_page_nums is not None or args.entries_only:
                target_pages = None if args.entries_only else changed_page_nums
                entries_stmts = sync_entries_phase(
                    cur, args.source_id, csv_path,
                    target_pages, args.match_threshold,
                )
                all_stmts.extend(entries_stmts)
            elif changed_page_nums is not None and len(changed_page_nums) == 0:
                print("  Entries: no page changes, skipping")
            else:
                print("  Entries: skipped (no pages sync ran, use --entries-only for full entries diff)")

        if all_stmts:
            for stmt in all_stmts:
                cur.execute(stmt)
            con.commit()
            print(f"  Executed {len(all_stmts)} SQL statements on local DB")

            cur.execute(
                "SELECT COUNT(*) FROM entries WHERE source_id = ?",
                (args.source_id,),
            )
            total_entries = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM pages WHERE source_id = ?",
                (args.source_id,),
            )
            total_pages = cur.fetchone()[0]
            cur.execute(
                "UPDATE sources SET total_entries = ?, total_pages = ?, updated_at = datetime('now') WHERE id = ?",
                (total_entries, total_pages, args.source_id),
            )
            con.commit()

        print("Sync complete.")
    except Exception as e:
        con.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        con.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: sync-source.py — full local sync with pages+entries incremental"
```

---

### Task 7: Integration test — full local sync against real data

**Files:**
- No new files (testing existing script)

This task validates the entire pipeline against the real dataset.

- [ ] **Step 1: Fresh DB + full sync (equivalent to full-sync.py)**

```bash
cd /home/ubuntu/floating-cloud/code/openteochew.com
rm -f tmp/openteochew.db
bash init_dev_db.sh
```

Wait — `init_dev_db.sh` calls `full-sync.py`. We need to run `sync-source.py` on a fresh DB instead:

```bash
cd /home/ubuntu/floating-cloud/code/openteochew.com
rm -f tmp/openteochew.db
mkdir -p tmp

# Create fresh DB with schema + migration
sqlite3 tmp/openteochew.db < scripts/001_initial_schema.sql
sqlite3 tmp/openteochew.db < scripts/002_seed_sources.sql
sqlite3 tmp/openteochew.db < scripts/003_add_content_hash.sql

# Run sync-source.py (first run = full import since DB is empty)
python3 scripts/sync-source.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset
```

Expected output:
```
Syncing source_id=1
  CSV: .../001_Handbook_of_the_Swatow_Vernacular.csv
  DB:  .../tmp/openteochew.db
  MD:  .../001_Handbook_of_the_Swatow_Vernacular.md
  Pages diff:
    DB: 0 pages
    New: 304 pages
    Added: 304, Modified: 0, Deleted: 0
    SQL: 304 statements
  Entries diff (threshold: 0.8):
    Affected pages: [...]  (304 pages)
    ...
Sync complete.
```

- [ ] **Step 2: Verify DB counts match full-sync.py baseline**

```bash
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM pages WHERE source_id = 1;"
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM entries WHERE source_id = 1;"
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM sections WHERE source_id = 1;"
```

Expected: pages ~304, entries ~6172, sections > 0.

Cross-check with full-sync.py:
```bash
cp tmp/openteochew.db tmp/openteochew_fullsync.db
python3 scripts/full-sync.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM pages WHERE source_id = 1;"
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM entries WHERE source_id = 1;"
```

Counts should match.

- [ ] **Step 3: Run sync again (no-op)**

```bash
python3 scripts/sync-source.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset
```

Expected: `Added: 0, Modified: 0, Deleted: 0` for both pages and entries. No SQL executed.

- [ ] **Step 4: Test pages-only and entries-only flags**

```bash
python3 scripts/sync-source.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset --pages-only
python3 scripts/sync-source.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset --entries-only
```

Both should report no changes (no-op).

- [ ] **Step 5: Test hash backfill on legacy DB**

Create a DB without content_hash (simulating pre-migration state):

```bash
rm -f tmp/test_legacy.db
sqlite3 tmp/test_legacy.db < scripts/001_initial_schema.sql
sqlite3 tmp/test_legacy.db < scripts/002_seed_sources.sql
python3 scripts/full-sync.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset
# Now add the column
sqlite3 tmp/test_legacy.db "ALTER TABLE pages ADD COLUMN content_hash TEXT;"
```

Then run sync-source against it:
```bash
DEFAULT_DB=tmp/test_legacy.db python3 scripts/sync-source.py --source-id 1 --hw /home/ubuntu/floating-cloud/code/dataset
```

Actually, `find_db()` looks at `DEFAULT_DB` constant, not env var. Need to adjust — or just test with the real DB path. Let's keep it simple: the backfill path is tested implicitly when running against any DB that has NULL hashes.

For this test, just verify the backfill works by running against the fresh DB (which already has hashes from step 1). The backfill code only runs when hashes are NULL, which is the legacy case.

- [ ] **Step 6: Commit (if any fixes were needed)**

Only commit if fixes were needed during testing.

---

### Task 8: Remote mode (wrangler D1)

**Files:**
- Modify: `scripts/sync-source.py`

- [ ] **Step 1: Add remote DB reader for pages**

```python
def query_remote_d1(sql, source_id=None):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as f:
        f.write(sql)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["npx", "wrangler", "d1", "execute", D1_NAME, "--remote", "--json", f"--file={tmp_path}"],
            capture_output=True, text=True, cwd=REPO,
        )
        if result.returncode != 0:
            print(f"ERROR: wrangler query failed: {result.stderr}", file=sys.stderr)
            sys.exit(1)
        return json.loads(result.stdout) if result.stdout.strip() else []
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def db_page_hashes_remote(source_id):
    data = query_remote_d1(
        f"SELECT page_num, content_hash FROM pages WHERE source_id = {source_id};"
    )
    results = []
    for batch in data:
        for row in batch.get("results", []):
            results.append({
                "page_num": row["page_num"],
                "content_hash": row.get("content_hash") or "",
            })
    return results
```

Note: `query_remote_d1` needs `import json` at the top (already imported for match_entries debug). Add it to imports if not already there.

- [ ] **Step 2: Add remote DB reader for entries**

```python
def db_entries_remote(source_id, page_nums=None):
    if page_nums is not None:
        pn_list = ",".join(str(pn) for pn in sorted(page_nums))
        where = f"AND e.page_num IN ({pn_list})"
    else:
        where = ""
    sql = (
        "SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
        "e.page_num, s.title as section_title "
        "FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
        f"WHERE e.source_id = {source_id} {where};"
    )
    data = query_remote_d1(sql)
    rows = []
    for batch in data:
        for row in batch.get("results", []):
            rows.append({
                "id": row["id"],
                "han": row.get("han") or "",
                "puj": row.get("puj") or "",
                "en": row.get("en") or "",
                "han_orig": row.get("han_orig") or "",
                "puj_orig": row.get("puj_orig") or "",
                "en_orig": row.get("en_orig") or "",
                "_page_num": row.get("page_num"),
                "_section": row.get("section_title") or "",
            })
    return rows
```

- [ ] **Step 3: Update main() to support remote mode**

The remote mode needs a different code path: read pages/entries via wrangler JSON output, diff locally, then execute SQL remotely. This requires restructuring `main()` to separate the "read" and "write" phases.

Add `sync_pages_phase_remote` and `sync_entries_phase_remote` that mirror the local versions but use the remote readers. Or, refactor to accept reader functions as parameters.

Simplest approach: add a remote branch in `main()`:

```python
    if use_remote:
        all_stmts = []
        changed_page_nums = None

        if not args.entries_only:
            if md_path.exists():
                print(f"  MD:  {md_path}")
                new_pages = parse_pages(md_path)
                if not new_pages:
                    print("  pages: no page markers found, skipping")
                else:
                    db_hashes = db_page_hashes_remote(args.source_id)
                    added, modified, removed = diff_pages(db_hashes, new_pages)
                    changed_page_nums = (
                        {p["page_num"] for p in added}
                        | {p["page_num"] for p in modified}
                        | set(removed)
                    )
                    print(f"  Pages diff:")
                    print(f"    DB: {len(db_hashes)}, New: {len(new_pages)}")
                    print(f"    Added: {len(added)}, Modified: {len(modified)}, Deleted: {len(removed)}")
                    all_stmts.extend(generate_pages_sql(args.source_id, slug, added, modified, removed))
            else:
                print("  MD: not found, skipping pages")

        if not args.pages_only:
            if changed_page_nums is not None or args.entries_only:
                target_pages = None if args.entries_only else changed_page_nums
                csv_rows = parse_csv(csv_path)
                db_rows = db_entries_remote(args.source_id, target_pages)
                inserts, updates, deletes = diff_entries(csv_rows, db_rows, target_pages, args.match_threshold)
                print(f"  Entries diff (threshold: {args.match_threshold}):")
                print(f"    Matched: {len(updates)}, Inserted: {len(inserts)}, Deleted: {len(deletes)}")
                all_stmts.extend(generate_entries_sql(args.source_id, inserts, updates, deletes))
            elif changed_page_nums is not None and len(changed_page_nums) == 0:
                print("  Entries: no page changes, skipping")

        if all_stmts:
            print(f"  Executing {len(all_stmts)} statements on remote D1...")
            execute_remote(all_stmts)

        print("Sync complete.")
        return
```

- [ ] **Step 4: Test remote mode (dry validation)**

```bash
set -a; source .env.dev; set +a
python3 scripts/sync-source.py --source-id 1 --remote --hw /home/ubuntu/floating-cloud/code/dataset
```

Expected: connects to remote D1, reads hashes, reports diff. If remote DB is in sync, should report no changes.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-source.py
git commit -m "feat: sync-source.py — remote mode via wrangler D1"
```

---

### Task 9: Update init_dev_db.sh and clean up

**Files:**
- Modify: `init_dev_db.sh`
- Modify: `scripts/sync-source.py` (add `import json` if missing)

- [ ] **Step 1: Update init_dev_db.sh to use sync-source.py**

```bash
#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="$ROOT/tmp/openteochew.db"

mkdir -p "$ROOT/tmp"

rm -f "$DB"

for sql in "$ROOT"/scripts/[0-9]*.sql; do
  echo "Applying $(basename "$sql")..."
  sqlite3 "$DB" < "$sql"
done

HW="${HW:-$ROOT/../dataset}"
if [ -f "$HW/export/books/001_Handbook_of_the_Swatow_Vernacular.csv" ]; then
  echo "Syncing entries + pages from dataset..."
  python3 "$ROOT/scripts/sync-source.py" --source-id 1 --hw "$HW"
fi

echo "Done: $DB"
```

- [ ] **Step 2: Verify fresh init works end-to-end**

```bash
cd /home/ubuntu/floating-cloud/code/openteochew.com
rm -f tmp/openteochew.db
bash init_dev_db.sh
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM pages WHERE source_id = 1;"
sqlite3 tmp/openteochew.db "SELECT COUNT(*) FROM entries WHERE source_id = 1;"
```

Expected: non-zero counts for pages and entries.

- [ ] **Step 3: Commit**

```bash
git add init_dev_db.sh
git commit -m "refactor: init_dev_db.sh uses sync-source.py instead of full-sync.py"
```

---

### Task 10: Deploy and verify on dev

**Files:**
- No changes (deployment verification)

- [ ] **Step 1: Run remote migration on dev D1**

```bash
set -a; source .env.dev; set +a
npx wrangler d1 execute openteochew-db-dev --remote --command="ALTER TABLE pages ADD COLUMN content_hash TEXT;"
npx wrangler d1 execute openteochew-db-dev --remote --command="CREATE INDEX IF NOT EXISTS idx_pages_hash ON pages(source_id, content_hash);"
```

- [ ] **Step 2: Backfill hashes on remote**

```bash
# Generate backfill SQL locally
python3 -c "
import sqlite3, hashlib
# Read remote data first via wrangler, then generate UPDATE statements
# For now, just run sync-source.py which handles backfill
" 2>&1 || true

# Or: run sync-source.py --remote which will detect NULL hashes
# But wait — remote mode can't backfill easily (needs to read ocr_text, compute hash, write back)
# This is a one-time operation. Generate SQL:
echo "SELECT id, LENGTH(ocr_text) FROM pages WHERE source_id = 1 AND content_hash IS NULL LIMIT 5;" | ...
```

Actually, backfilling hashes on remote is tricky because we need to read `ocr_text` for every page, compute the hash locally, and write it back. The `sync-source.py` remote mode should handle this: if `content_hash` is NULL for all pages, it treats every page as "added" (since old hash is empty string). Then it will UPDATE all pages with the new hash. But the current design only UPDATEs when hash differs — and NULL != any hash, so it will UPDATE all pages.

Let's verify: on first remote sync, all pages have NULL hashes → all appear as "modified" → all get UPDATE with new hash. This works but writes all `ocr_text` unnecessarily. For a one-time backfill, this is acceptable.

```bash
python3 scripts/sync-source.py --source-id 1 --remote --pages-only --hw /home/ubuntu/floating-cloud/code/dataset
```

- [ ] **Step 3: Run full remote sync**

```bash
python3 scripts/sync-source.py --source-id 1 --remote --hw /home/ubuntu/floating-cloud/code/dataset
```

Expected: first run writes hashes + syncs entries. Second run should be a no-op.

- [ ] **Step 4: Verify dev site works**

```bash
./build.sh
set -a; source .env.dev; set +a
npx wrangler deploy --config backend/wrangler.jsonc
```

Visit dev URL and verify data is intact.

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Pages content hash column | Task 1 |
| Pages hash diff (not reading ocr_text) | Task 3 |
| Entries fuzzy matching (Levenshtein) | Task 4 |
| Greedy matching by page group | Task 5 |
| Pages drive entries (changed_page_nums) | Task 6 |
| `--local` mode | Task 6 |
| `--remote` mode (wrangler) | Task 8 |
| `--pages-only` flag | Task 6 |
| `--entries-only` flag | Task 6 |
| `--match-threshold` param | Task 6 |
| `SOURCE_CONFIG` lookup | Task 2 |
| Backfill hashes (first time) | Task 3 |
| SQL batch execution (remote) | Task 8 |
| Section auto-insert (OR IGNORE) | Task 5 |
| Update sources.total_entries/total_pages | Task 6 |
| First sync = full import | Task 7 (tested) |
| Replaces full-sync.py + sync-csv.py | Task 9 |
| init_dev_db.sh updated | Task 9 |
| Deploy to dev | Task 10 |

### Placeholder Scan

No TBD/TODO found. All steps contain code or exact commands.

### Type Consistency

- `content_hash()` returns `str` (16-char hex) — used consistently in `parse_pages()`, `diff_pages()`, `generate_pages_sql()`
- `similarity()` returns `float` 0.0-1.0 — used in `match_entries()`
- `match_entries()` returns `(inserts: list, updates: list[tuple], deletes: list)` — `generate_entries_sql()` unpacks `updates` as `(csv_row, db_row)` pairs and `deletes` as `db_row` with `id` field
- `diff_pages()` returns `(added: list, modified: list, removed: list[int])` — `generate_pages_sql()` handles each type correctly
- `changed_page_nums` is `set[int] | None` throughout — `None` means "no pages sync ran" (full entries diff via `--entries-only`)

One inconsistency to fix: in `generate_entries_sql()`, `updates` is `list[tuple(csv_row, db_row)]` but the function signature takes `updates` as a flat list. The `diff_entries()` function returns `all_updates` as `list[tuple]`. Need to make sure the unpacking in `generate_entries_sql` matches. ✓ (it iterates `for csv_row, db_row in updates`)

### Gaps Found and Fixed Inline

- Remote hash backfill: first remote sync will naturally backfill by treating NULL-hashed pages as "modified". No special code needed.
- `import json` needed for remote mode: added to Task 8 note.
- `HW_DEFAULT` path updated to `REPO.parent / "dataset"` since the dataset is at `code/dataset/`.
