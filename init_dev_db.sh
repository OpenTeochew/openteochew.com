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

if [ -d "$HOME/Documents/Code/hokkien-writing/dataset/export/books" ]; then
  echo "Syncing entries from hokkien-writing..."
  python3 "$ROOT/scripts/full-sync.py"
fi

echo "Done: $DB"
