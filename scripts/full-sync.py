#!/usr/bin/env python3
import argparse
import csv
import re
import sqlite3
import sys
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
PAGE_RE = re.compile(r"<!-- page:(\d+) -->")


def find_db():
    if DEFAULT_DB.exists():
        return DEFAULT_DB
    if WRANGLER_DB_DIR.is_dir():
        for f in WRANGLER_DB_DIR.glob("*.sqlite"):
            if f.name != "metadata.sqlite":
                return f
    print("ERROR: local D1 database not found. Run `./init_dev_db.sh` first.", file=sys.stderr)
    sys.exit(1)


def parse_section(source_field):
    if not source_field:
        return None
    m = SECTION_RE.search(source_field)
    return m.group(1).strip() if m else None


def sync_entries(cur, source_id, csv_path):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(row)

    sections = {}
    section_order = 0

    cur.execute("DELETE FROM entries WHERE source_id = ?", (source_id,))
    cur.execute("DELETE FROM sections WHERE source_id = ?", (source_id,))

    for row in rows:
        section_title = parse_section(row.get("source", ""))
        section_id = None
        if section_title:
            if section_title not in sections:
                section_order += 1
                cur.execute(
                    "INSERT INTO sections (source_id, title, sort_order) VALUES (?, ?, ?)",
                    (source_id, section_title, section_order),
                )
                sections[section_title] = cur.lastrowid
            section_id = sections[section_title]

        page_num = row.get("page_num", "").strip()
        page_num_int = int(page_num) if page_num else None

        cur.execute(
            "INSERT INTO entries (source_id, section_id, han, puj, en, han_orig, puj_orig, en_orig, page_num, sort_order) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                source_id,
                section_id,
                row.get("han") or None,
                row.get("puj") or None,
                row.get("en") or None,
                row.get("han_orig") or None,
                row.get("puj_orig") or None,
                row.get("en_orig") or None,
                page_num_int,
                0,
            ),
        )

    cur.execute(
        "UPDATE sources SET total_entries = ?, updated_at = datetime('now') WHERE id = ?",
        (len(rows), source_id),
    )
    print(f"  entries: {len(rows)}, sections: {len(sections)}")
    return len(rows)


def sync_pages(cur, source_id, md_path, slug):
    content = md_path.read_text(encoding="utf-8")
    markers = list(PAGE_RE.finditer(content))
    if not markers:
        print("  pages: no page markers found, skipping")
        return 0

    cur.execute("DELETE FROM pages WHERE source_id = ?", (source_id,))

    count = 0
    for i in range(len(markers)):
        page_num = int(markers[i].group(1))
        start = markers[i].end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(content)
        ocr_text = content[start:end].strip()
        image_url = f"https://static.openteochew.com/{slug}/{str(page_num).zfill(4)}.webp"

        cur.execute(
            "INSERT INTO pages (source_id, page_num, image_url, ocr_text, sort_order) VALUES (?, ?, ?, ?, ?)",
            (source_id, page_num, image_url, ocr_text, page_num),
        )
        count += 1

    cur.execute(
        "UPDATE sources SET total_pages = ?, updated_at = datetime('now') WHERE id = ?",
        (count, source_id),
    )
    print(f"  pages: {count} (range {markers[0].group(1)}-{markers[-1].group(1)})")
    return count


def main():
    parser = argparse.ArgumentParser(description="Full sync CSV + OCR pages to local D1")
    parser.add_argument("--source-id", type=int, default=1, help="source_id to sync (default: 1)")
    parser.add_argument("--csv", type=Path, help="override CSV path")
    parser.add_argument("--md", type=Path, help="override markdown path")
    parser.add_argument("--hw", type=Path, default=HW_DEFAULT, help="hokkien-writing/dataset root")
    parser.add_argument("--entries-only", action="store_true", help="skip pages sync")
    parser.add_argument("--pages-only", action="store_true", help="skip entries sync")
    args = parser.parse_args()

    db_path = find_db()
    cfg = SOURCE_CONFIG.get(args.source_id)
    hw = args.hw

    slug = cfg.get("slug", str(args.source_id)) if cfg else str(args.source_id)
    csv_path = args.csv or (hw / "export" / "books" / cfg["csv"] if cfg else None)
    md_path = args.md or (hw / "books" / cfg["md"] if cfg else None)

    if not csv_path or not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Syncing source_id={args.source_id}")
    print(f"  DB:  {db_path}")
    print(f"  CSV: {csv_path}")

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    try:
        if not args.pages_only:
            print("  syncing entries...")
            sync_entries(cur, args.source_id, csv_path)

        if not args.entries_only:
            if md_path and md_path.exists():
                print(f"  MD:  {md_path}")
                print("  syncing pages...")
                sync_pages(cur, args.source_id, md_path, slug)
            else:
                print(f"  MD:  not found, skipping pages")

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
