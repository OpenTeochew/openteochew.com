#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DB = REPO / "tmp" / "openteochew.db"
WRANGLER_DB_DIR = REPO / "backend" / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
HW_DEFAULT = Path(__file__).resolve().parent.parent.parent / "dataset"
D1_NAME = "openteochew-db-dev"
BATCH_SIZE = 100

SOURCE_CONFIG = {
    1: {
        "csv": "001_Handbook_of_the_Swatow_Vernacular.csv",
        "md": "001_Handbook_of_the_Swatow_Vernacular.md",
        "slug": "Handbook_of_the_Swatow_Vernacular",
    },
}

SECTION_RE = re.compile(r">\s*(.+)$")
PAGE_RE = re.compile(r"<!-- page:(\d+) -->")

MATCH_FIELDS = [
    ("han", 2.0),
    ("han_orig", 2.0),
    ("puj", 2.0),
    ("puj_orig", 2.0),
    ("en", 2.0),
    ("en_orig", 2.0),
]


def find_db():
    if DEFAULT_DB.exists():
        return DEFAULT_DB
    if WRANGLER_DB_DIR.is_dir():
        for f in WRANGLER_DB_DIR.glob("*.sqlite"):
            if f.name != "metadata.sqlite":
                return f
    print("ERROR: local D1 database not found. Run `./init_dev_db.sh` first.", file=sys.stderr)
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


def parse_csv(csv_path):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row["_section"] = parse_section(row.get("source", ""))
            page_num = row.get("page_num", "").strip()
            row["_page_num"] = int(page_num) if page_num else None
            rows.append(row)
    return rows


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


def diff_pages(db_hashes, new_pages):
    db_map = {p["page_num"]: p["content_hash"] for p in db_hashes}
    new_map = {p["page_num"]: p for p in new_pages}

    added = []
    modified = []
    removed = []

    for pn, page in new_map.items():
        if pn not in db_map:
            added.append(page)
        elif db_map[pn] != page["content_hash"]:
            modified.append(page)

    for pn in db_map:
        if pn not in new_map:
            removed.append(pn)

    return added, modified, removed


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


def backfill_hashes(cur, source_id):
    cur.execute(
        "SELECT id, ocr_text FROM pages WHERE source_id = ? AND content_hash IS NULL",
        (source_id,),
    )
    rows = cur.fetchall()
    for row in rows:
        pid, ocr_text = row
        h = content_hash(ocr_text or "")
        cur.execute(
            "UPDATE pages SET content_hash = ? WHERE id = ?",
            (h, pid),
        )
    return len(rows)


def levenshtein_ratio(s1, s2):
    if not s1 and not s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    max_len = max(len1, len2)
    if max_len == 0:
        return 1.0
    if abs(len1 - len2) > max_len * 0.5:
        return 0.0

    prev = list(range(len2 + 1))
    curr = [0] * (len2 + 1)

    for i in range(1, len1 + 1):
        curr[0] = i
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev, curr = curr, prev

    return 1.0 - prev[len2] / max_len


def similarity(csv_row, db_row):
    total_weight = 0.0
    total_score = 0.0

    for field, weight in MATCH_FIELDS:
        csv_val = (csv_row.get(field) or "").strip()
        db_val = (db_row.get(field) or "").strip()
        if not csv_val and not db_val:
            continue
        total_weight += weight
        total_score += weight * levenshtein_ratio(csv_val, db_val)

    return total_score / total_weight if total_weight > 0 else 0.0


def match_entries(csv_group, db_group, threshold=0.8):
    used_db = set()
    inserts = []
    updates = []
    used_csv_indices = set()

    csv_indices = list(range(len(csv_group)))
    db_indices = list(range(len(db_group)))

    scored = []
    for ci in csv_indices:
        for di in db_indices:
            if di in used_db:
                continue
            sim = similarity(csv_group[ci], db_group[di])
            if sim >= threshold:
                scored.append((sim, ci, di))

    scored.sort(key=lambda x: x[0], reverse=True)

    for sim, ci, di in scored:
        if ci in used_csv_indices or di in used_db:
            continue
        updates.append((csv_group[ci], db_group[di]))
        used_csv_indices.add(ci)
        used_db.add(di)

    for ci in csv_indices:
        if ci not in used_csv_indices:
            inserts.append(csv_group[ci])

    deletes = [db_group[di] for di in db_indices if di not in used_db]

    return inserts, updates, deletes


def diff_entries(csv_rows, db_rows, changed_page_nums, threshold=0.8):
    csv_by_page = {}
    for row in csv_rows:
        pn = row.get("_page_num")
        csv_by_page.setdefault(pn, []).append(row)

    db_by_page = {}
    for row in db_rows:
        pn = row.get("_page_num")
        db_by_page.setdefault(pn, []).append(row)

    all_inserts = []
    all_updates = []
    all_deletes = []

    if changed_page_nums is not None:
        target_pages = changed_page_nums
    else:
        all_pages = set(csv_by_page.keys()) | set(db_by_page.keys())
        target_pages = all_pages

    for pn in target_pages:
        cg = csv_by_page.get(pn, [])
        dg = db_by_page.get(pn, [])
        if not cg and not dg:
            continue
        inserts, updates, deletes = match_entries(cg, dg, threshold)
        all_inserts.extend(inserts)
        all_updates.extend(updates)
        all_deletes.extend(deletes)

    return all_inserts, all_updates, all_deletes


def db_entries_by_page(cur, source_id, page_nums=None):
    if page_nums is not None:
        placeholders = ",".join("?" * len(page_nums))
        cur.execute(
            f"SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
            f"e.page_num, s.title "
            f"FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
            f"WHERE e.source_id = ? AND e.page_num IN ({placeholders})",
            (source_id, *page_nums),
        )
    else:
        cur.execute(
            "SELECT e.id, e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, "
            "e.page_num, s.title "
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


def generate_entries_sql(source_id, inserts, updates, deletes):
    stmts = []
    new_sections = set()

    for csv_row, _ in updates:
        title = csv_row.get("_section")
        if title and title not in new_sections:
            new_sections.add(title)

    for csv_row in inserts:
        title = csv_row.get("_section")
        if title and title not in new_sections:
            new_sections.add(title)

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
            f"{sql_val(csv_row.get('en'))}, {sql_val(csv_row.get('han_orig'))}, "
            f"{sql_val(csv_row.get('puj_orig'))}, {sql_val(csv_row.get('en_orig'))}, "
            f"{sql_num(csv_row.get('page_num'))}, 0);"
        )

    for csv_row, db_row in updates:
        title = csv_row.get("_section")
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
            f"WHERE id = {db_row['id']};"
        )

    for db_row in deletes:
        stmts.append(
            f"DELETE FROM entries WHERE id = {db_row['id']};"
        )

    return stmts


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
                ["npx", "wrangler", "d1", "execute", D1_NAME, "--remote", f"--file={tmp_path}"],
                check=True, cwd=REPO,
            )
            Path(tmp_path).unlink(missing_ok=True)
            tmp_path = None
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


def sync_pages_phase(cur, source_id, md_path, slug):
    new_pages = parse_pages(md_path)
    if not new_pages:
        print("  pages: no page markers found, skipping")
        return set(), []

    backfilled = backfill_hashes(cur, source_id)
    if backfilled:
        print(f"  backfilled {backfilled} page hashes")

    cur.execute(
        "SELECT page_num, content_hash FROM pages WHERE source_id = ?",
        (source_id,),
    )
    db_hashes = [{"page_num": r[0], "content_hash": r[1] or ""} for r in cur.fetchall()]

    added, modified, removed = diff_pages(db_hashes, new_pages)
    print(f"  pages diff: +{len(added)} ~{len(modified)} -{len(removed)}")

    changed_page_nums = set()
    for p in added:
        changed_page_nums.add(p["page_num"])
    for p in modified:
        changed_page_nums.add(p["page_num"])
    for pn in removed:
        changed_page_nums.add(pn)

    stmts = generate_pages_sql(source_id, slug, added, modified, removed)

    if not stmts:
        print("  pages: no changes")

    return changed_page_nums, stmts


def sync_entries_phase(cur, source_id, csv_path, changed_page_nums, threshold):
    csv_rows = parse_csv(csv_path)
    print(f"  CSV: {len(csv_rows)} rows")

    if changed_page_nums is not None:
        page_nums_list = list(changed_page_nums) if changed_page_nums else None
    else:
        page_nums_list = None

    db_rows = db_entries_by_page(cur, source_id, page_nums_list)
    print(f"  DB entries (scoped): {len(db_rows)} rows")

    inserts, updates, deletes = diff_entries(csv_rows, db_rows, changed_page_nums, threshold)
    print(f"  entries diff: +{len(inserts)} ~{len(updates)} -{len(deletes)}")

    stmts = generate_entries_sql(source_id, inserts, updates, deletes)

    if not stmts:
        print("  entries: no changes")

    return stmts


def query_remote(sql):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as f:
        f.write(sql)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["npx", "wrangler", "d1", "execute", D1_NAME, "--remote", "--json", f"--file={tmp_path}"],
            capture_output=True, text=True, cwd=REPO,
        )
        if result.returncode != 0:
            print(f"ERROR: wrangler query failed:\n{result.stderr}", file=sys.stderr)
            sys.exit(1)
        if not result.stdout.strip():
            return []
        data = json.loads(result.stdout)
        rows = []
        for batch in data:
            for row in batch.get("results", []):
                rows.append(row)
        return rows
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def db_page_hashes_remote(source_id):
    rows = query_remote(
        f"SELECT page_num, content_hash FROM pages WHERE source_id = {source_id};"
    )
    return [{"page_num": r["page_num"], "content_hash": r.get("content_hash") or ""} for r in rows]


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
    rows = query_remote(sql)
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "han": r.get("han") or "",
            "puj": r.get("puj") or "",
            "en": r.get("en") or "",
            "han_orig": r.get("han_orig") or "",
            "puj_orig": r.get("puj_orig") or "",
            "en_orig": r.get("en_orig") or "",
            "_page_num": r.get("page_num"),
            "_section": r.get("section_title") or "",
        })
    return result


def main():
    parser = argparse.ArgumentParser(description="Unified incremental sync for D1")
    parser.add_argument("--source-id", type=int, required=True)
    parser.add_argument("--csv", type=Path, help="override CSV path")
    parser.add_argument("--md", type=Path, help="override markdown path")
    parser.add_argument("--hw", type=Path, default=HW_DEFAULT, help="dataset root")
    parser.add_argument("--local", action="store_true", help="sync to local SQLite (default)")
    parser.add_argument("--remote", action="store_true", help="sync to remote D1 via wrangler")
    parser.add_argument("--pages-only", action="store_true", help="skip entries sync")
    parser.add_argument("--entries-only", action="store_true", help="skip pages sync")
    parser.add_argument("--match-threshold", type=float, default=0.8, help="fuzzy match threshold")
    args = parser.parse_args()

    cfg = SOURCE_CONFIG.get(args.source_id)
    if not cfg:
        print(f"ERROR: no config for source_id={args.source_id}", file=sys.stderr)
        sys.exit(1)

    slug = cfg["slug"]
    hw = args.hw
    csv_path = args.csv or (hw / "export" / "books" / cfg["csv"])
    md_path = args.md or (hw / "books" / cfg["md"])

    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    if args.remote:
        print(f"sync source_id={args.source_id} (remote)")
        all_stmts = []
        changed_page_nums = None

        if not args.entries_only and md_path and md_path.exists():
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
                print(f"  pages diff: +{len(added)} ~{len(modified)} -{len(removed)}")
                all_stmts.extend(generate_pages_sql(args.source_id, slug, added, modified, removed))

        if not args.pages_only:
            target_pages = None if args.entries_only else changed_page_nums
            if target_pages is not None or args.entries_only:
                csv_rows = parse_csv(csv_path)
                db_rows = db_entries_remote(args.source_id, target_pages)
                inserts, updates, deletes = diff_entries(csv_rows, db_rows, target_pages, args.match_threshold)
                print(f"  entries diff: +{len(inserts)} ~{len(updates)} -{len(deletes)}")
                all_stmts.extend(generate_entries_sql(args.source_id, inserts, updates, deletes))
            elif changed_page_nums is not None and not changed_page_nums:
                print("  no page changes, skipping entries")

        if all_stmts:
            execute_remote(all_stmts)

        print("sync complete.")
        return

    db_path = find_db()
    print(f"sync source_id={args.source_id}")
    print(f"  DB:  {db_path}")
    print(f"  CSV: {csv_path}")

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    try:
        all_stmts = []
        changed_page_nums = None

        if not args.entries_only:
            if md_path and md_path.exists():
                print(f"  MD:  {md_path}")
                changed_page_nums, pages_stmts = sync_pages_phase(
                    cur, args.source_id, md_path, slug
                )
                all_stmts.extend(pages_stmts)
            else:
                print(f"  MD:  not found, skipping pages")

        if not args.pages_only:
            if args.entries_only:
                entries_changed = None
            elif changed_page_nums is not None and not changed_page_nums:
                print("  no page changes, skipping entries")
                entries_changed = None
            elif changed_page_nums is not None:
                entries_changed = changed_page_nums
            else:
                entries_changed = None

            if entries_changed is not None or args.entries_only:
                entries_stmts = sync_entries_phase(
                    cur, args.source_id, csv_path, entries_changed, args.match_threshold
                )
                all_stmts.extend(entries_stmts)

        if all_stmts:
            for stmt in all_stmts:
                cur.execute(stmt)

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
                "UPDATE sources SET total_entries = ?, total_pages = ?, updated_at = datetime('now') "
                "WHERE id = ?",
                (total_entries, total_pages, args.source_id),
            )

        con.commit()
        print("  done.")
    except Exception as e:
        con.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        con.close()


if __name__ == "__main__":
    main()
