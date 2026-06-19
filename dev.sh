#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Build local SQLite from dataset if needed
if [ ! -f "$ROOT/tmp/openteochew.db" ] || [ "$(sqlite3 "$ROOT/tmp/openteochew.db" 'SELECT COUNT(*) FROM entries;')" = "0" ]; then
  bash "$ROOT/scripts/init_dev_db.sh"
fi

cd "$ROOT/backend"

# Reset local D1 state
rm -rf .wrangler/state/v3/d1

# Create D1 SQLite file with a no-op query
npx wrangler d1 execute openteochew-db --local --command "SELECT 1" 2>/dev/null

# Copy the fully populated SQLite directly into D1 (overwrite + remove stale WAL)
D1_FILE=$(find .wrangler/state/v3/d1/miniflare-D1DatabaseObject -name "*.sqlite" ! -name "metadata.sqlite")
cp -f "$ROOT/tmp/openteochew.db" "$D1_FILE"
rm -f "$D1_FILE-wal" "$D1_FILE-shm"

# Sync source metadata from CSV (inserts source records, updates counts)
bash "$ROOT/scripts/sync-sources.sh" --local 2>/dev/null

npx wrangler dev
