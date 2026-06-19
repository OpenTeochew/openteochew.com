#!/usr/bin/env python3
"""
Incremental CSV sync to D1.

Modes:
  1. Local mode (default) — diff CSV against existing DB entries:
       python3 scripts/sync-csv.py --source-id 1 --local

  2. Git-range mode — diff two CSV snapshots via git show (for CI):
       python3 scripts/sync-csv.py --source-id 1 --remote \\
         --git-range HEAD~1..HEAD \\
         --csv-path "export/books/001_Handbook_of_the_Swatow_Vernacular.csv" \\
         --git-cwd /path/to/hokkien-writing/dataset

  --local   write to local SQLite (default)
  --remote  write to remote D1 via wrangler d1 execute
"""
import argparse
import csv
import io
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
HW_DEFAULT = Path.home() / "Documents" / "Code" / "hokkien-writing" / "dataset"

SOURCE_CONFIG = {
    1: {
        "csv": "001_Handbook_of_the_Swatow_Vernacular.csv",
        "md": "001_Handbook_of_the_Swatow_Vernacular.md",
        "slug": "Handbook_of_the_Swatow_Vernacular",
    },
}

SECTION_RE = re.compile(r">\s*(.+)$")
D1_NAME = "openteochew-db"
BATCH_SIZE = 100


def find_db():
    if DEFAULT_DB.exists():
        return DEFAULT_DB
    if WRANGLER_DB_DIR.is_dir():
        for f in WRANGLER_DB_DIR.glob("*.sqlite"):
            if f.name != "metadata.sqlite":
                return f
    print("ERROR: local D1 database not found. Run `./scripts/init_dev_db.sh` first.", file=sys.stderr)
    sys.exit(1)


def parse_section(source_field):
    if not source_field:
        return None
    m = SECTION_RE.search(source_field)
    return m.group(1).strip() if m else None


def git_show(ref, path, cwd=None):
    try:
        result = subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            capture_output=True, text=True, cwd=cwd,
        )
        return result.stdout if result.returncode == 0 else None
    except Exception:
        return None


def parse_csv_text(text):
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def parse_csv_file(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [row for row in csv.DictReader(f)]


def annotate_sections(rows):
    for row in rows:
        row["_section"] = parse_section(row.get("source", ""))
    return rows


def make_key(row):
    return json.dumps([
        row.get("puj") or "",
        row.get("han") or "",
        row.get("en") or "",
        row.get("_section") or "",
    ], ensure_ascii=False)


def diff_rows(old_rows, new_rows):
    old_map = {make_key(r): r for r in old_rows}
    new_map = {make_key(r): r for r in new_rows}

    added = []
    modified = []
    removed = []

    for key, new_row in new_map.items():
        if key not in old_map:
            added.append(new_row)
        else:
            old_row = old_map[key]
            if (old_row.get("puj_orig") != new_row.get("puj_orig") or
                    old_row.get("han_orig") != new_row.get("han_orig") or
                    old_row.get("en_orig") != new_row.get("en_orig")):
                modified.append(new_row)

    for key, old_row in old_map.items():
        if key not in new_map:
            removed.append(old_row)

    return {"added": added, "modified": modified, "removed": removed}


def db_rows_to_csv_rows(cur, source_id):
    cur.execute(
        "SELECT e.han, e.puj, e.en, e.han_orig, e.puj_orig, e.en_orig, e.page_num, s.title as section_title "
        "FROM entries e LEFT JOIN sections s ON e.section_id = s.id "
        "WHERE e.source_id = ?",
        (source_id,),
    )
    rows = []
    for r in cur.fetchall():
        row = {
            "han": r[0] or "",
            "puj": r[1] or "",
            "en": r[2] or "",
            "han_orig": r[3] or "",
            "puj_orig": r[4] or "",
            "en_orig": r[5] or "",
            "page_num": str(r[6]) if r[6] is not None else "",
            "source": "",
            "_section": r[7] or "",
        }
        rows.append(row)
    return rows


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


def generate_sql(source_id, diff_result):
    statements = []
    existing_titles = set()
    new_section_titles = set()

    for row in diff_result["added"]:
        title = row.get("_section")
        if title and title not in existing_titles and title not in new_section_titles:
            new_section_titles.add(title)

    for title in new_section_titles:
        statements.append(
            f"INSERT OR IGNORE INTO sections (source_id, title, sort_order) "
            f"VALUES ({source_id}, '{sql_escape(title)}', 0);"
        )

    for row in diff_result["added"]:
        title = row.get("_section")
        statements.append(
            f"INSERT INTO entries "
            f"(source_id, section_id, han, puj, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
            f"VALUES ({source_id}, {section_subquery(source_id, title)}, "
            f"{sql_val(row.get('han'))}, {sql_val(row.get('puj'))}, {sql_val(row.get('en'))}, "
            f"{sql_val(row.get('han_orig'))}, {sql_val(row.get('puj_orig'))}, "
            f"{sql_val(row.get('en_orig'))}, {sql_num(row.get('page_num'))}, 0);"
        )

    for row in diff_result["modified"]:
        title = row.get("_section")
        statements.append(
            f"UPDATE entries SET "
            f"han = {sql_val(row.get('han'))}, "
            f"puj = {sql_val(row.get('puj'))}, "
            f"en = {sql_val(row.get('en'))}, "
            f"han_orig = {sql_val(row.get('han_orig'))}, "
            f"puj_orig = {sql_val(row.get('puj_orig'))}, "
            f"en_orig = {sql_val(row.get('en_orig'))}, "
            f"page_num = {sql_num(row.get('page_num'))}, "
            f"section_id = {section_subquery(source_id, title)} "
            f"WHERE source_id = {source_id} "
            f"AND puj = {sql_val(row.get('puj'))} "
            f"AND han = {sql_val(row.get('han'))} "
            f"AND en = {sql_val(row.get('en'))};"
        )

    for row in diff_result["removed"]:
        title = row.get("_section")
        statements.append(
            f"DELETE FROM entries "
            f"WHERE source_id = {source_id} "
            f"AND puj = {sql_val(row.get('puj'))} "
            f"AND han = {sql_val(row.get('han'))} "
            f"AND en = {sql_val(row.get('en'))} "
            f"AND section_id = {section_subquery(source_id, title)};"
        )

    return statements


def execute_local(db_path, statements):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    try:
        for stmt in statements:
            cur.execute(stmt)
        con.commit()
        print(f"  Executed {len(statements)} statements on local DB")
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


def main():
    parser = argparse.ArgumentParser(description="Incremental CSV sync to D1 (local or remote)")
    parser.add_argument("--csv-path", type=str,
                        help="CSV path (repo-relative for --git-range, absolute for file mode)")
    parser.add_argument("--source-id", type=int, required=True)
    parser.add_argument("--git-range", type=str, default=None,
                        help="git range for diff, e.g. HEAD~1..HEAD (default: diff against DB)")
    parser.add_argument("--git-cwd", type=str, default=None,
                        help="directory to run git commands in (default: inferred from csv-path)")
    parser.add_argument("--local", action="store_true", help="sync to local SQLite (default)")
    parser.add_argument("--remote", action="store_true", help="sync to remote D1 via wrangler")
    args = parser.parse_args()

    use_remote = args.remote

    new_rows = None
    old_rows = []

    if args.git_range:
        if not args.csv_path:
            print("ERROR: --csv-path is required with --git-range", file=sys.stderr)
            sys.exit(1)

        old_ref, new_ref = args.git_range.split("..")
        csv_path = args.csv_path

        git_cwd = args.git_cwd
        if not git_cwd:
            p = Path(csv_path)
            git_cwd = str(p.parent) if not p.is_absolute() else None

        print("Reading CSV snapshots via git...")
        old_text = git_show(old_ref, csv_path, cwd=git_cwd)
        new_text = git_show(new_ref, csv_path, cwd=git_cwd)

        if not new_text:
            print(f"ERROR: Cannot read CSV at {new_ref}:{csv_path}", file=sys.stderr)
            sys.exit(1)

        new_rows = annotate_sections(parse_csv_text(new_text))
        print(f"New CSV: {len(new_rows)} rows")

        if old_text:
            old_rows = annotate_sections(parse_csv_text(old_text))
            print(f"Old CSV: {len(old_rows)} rows")
        else:
            print("No old version found — treating as full import")
    else:
        if args.csv_path:
            csv_path = args.csv_path
        else:
            cfg = SOURCE_CONFIG.get(args.source_id)
            if not cfg:
                print(f"ERROR: No CSV path provided and no config for source_id={args.source_id}",
                      file=sys.stderr)
                sys.exit(1)
            csv_path = str(Path(args.hw if hasattr(args, 'hw') else HW_DEFAULT) / "export" / "books" / cfg["csv"])

        print(f"Reading CSV: {csv_path}")
        new_rows = annotate_sections(parse_csv_file(csv_path))
        print(f"CSV: {len(new_rows)} rows")

        if not use_remote:
            db_path = find_db()
            con = sqlite3.connect(db_path)
            cur = con.cursor()
            old_rows = db_rows_to_csv_rows(cur, args.source_id)
            con.close()
            print(f"DB entries: {len(old_rows)} rows")

    print("Diffing...")
    diff_result = diff_rows(old_rows, new_rows)
    print(f"Added: {len(diff_result['added'])}, "
          f"Modified: {len(diff_result['modified'])}, "
          f"Removed: {len(diff_result['removed'])}")

    if not diff_result["added"] and not diff_result["modified"] and not diff_result["removed"]:
        print("No changes detected.")
        return

    print("Generating SQL...")
    statements = generate_sql(args.source_id, diff_result)
    print(f"  {len(statements)} SQL statements generated")

    if use_remote:
        print("Executing on remote D1 via wrangler...")
        execute_remote(statements)
    else:
        db_path = find_db()
        print(f"Executing on local DB: {db_path}")
        execute_local(db_path, statements)

    print("Sync complete.")


if __name__ == "__main__":
    main()
