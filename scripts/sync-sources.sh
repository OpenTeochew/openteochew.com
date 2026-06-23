#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
CSV="$ROOT/scripts/sources.csv"
DB="openteochew-db"

show_help() {
  cat <<EOF
Usage: $(basename "$0") [--local | --remote]

Sync sources metadata from scripts/sources.csv to D1 database.

Modes:
  --local   Write to local D1 (default)
  --remote  Write to remote D1
  --help    Show this help
EOF
}

MODE="--local"
if [ "${1:-}" = "--remote" ]; then MODE="--remote"; fi
if [ "${1:-}" = "--help" ]; then show_help; exit 0; fi

if [ "$MODE" = "--remote" ]; then
  if [ ! -f "$ROOT/.env.dev" ]; then
    echo "Error: $ROOT/.env.dev not found (required for --remote)" >&2
    exit 1
  fi
  set -a
  source "$ROOT/.env.dev"
  set +a
fi

if [ ! -f "$CSV" ]; then
  echo "Error: $CSV not found" >&2
  exit 1
fi

SQL_FILE="/tmp/openteochew-sync-sources-$$.sql"

python3 <<PYEOF > "$SQL_FILE"
import csv, sys

FIELDS = ["id","name","name_zh","author","year","type","level","status","description","sort_order","original_fields","scan_source","proofread_note"]

with open("$CSV", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"-- Syncing {len(rows)} sources from scripts/sources.csv")
for row in rows:
    vals = []
    for c in FIELDS:
        v = row.get(c, "").strip()
        if v == "":
            vals.append("NULL")
        else:
            vals.append(f"'{v.replace(chr(39), chr(39)+chr(39))}'")
    print(f"INSERT OR REPLACE INTO sources ({','.join(FIELDS)}) VALUES ({','.join(vals)});")

print("UPDATE sources SET total_entries = (SELECT COUNT(*) FROM entries WHERE entries.source_id = sources.id), total_pages = (SELECT COUNT(*) FROM pages WHERE pages.source_id = sources.id);")
PYEOF

echo "Generated SQL ($(wc -l < "$SQL_FILE") lines)"
head -5 "$SQL_FILE" | while read -r l; do echo "  $l"; done
echo "  ..."

echo ""
echo "Executing on D1 ($MODE) ..."

cd "$BACKEND"
if [ "$MODE" = "--local" ]; then
  npx wrangler d1 execute "$DB" --local --file "$SQL_FILE"
else
  npx wrangler d1 execute "$DB" --remote --file "$SQL_FILE"
fi
cd "$ROOT"

rm -f "$SQL_FILE"
echo "Done."
