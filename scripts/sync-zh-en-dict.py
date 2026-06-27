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
