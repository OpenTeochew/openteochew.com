#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$ROOT/tmp/openteochew.db"
HW="${HW:-$HOME/Documents/Code/hokkien-writing/dataset}"

trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR

mkdir -p "$ROOT/tmp"
rm -f "$DB"

for sql in "$ROOT"/scripts/[0-9]*.sql; do
  echo "Applying $(basename "$sql")..."
  sqlite3 "$DB" < "$sql"
done

if [ -f "$HW/export/books/001_Handbook_of_the_Swatow_Vernacular.csv" ]; then
  echo "Syncing from dataset ($HW)..."
  python3 "$ROOT/scripts/sync-entries.py" --source-id 1 --hw "$HW"
fi

echo "Done: $DB"
