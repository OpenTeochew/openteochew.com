#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/tmp/openteochew.db" ] || [ "$(sqlite3 "$ROOT/tmp/openteochew.db" 'SELECT COUNT(*) FROM entries;')" = "0" ]; then
  bash "$ROOT/scripts/init_dev_db.sh"
fi

cd "$ROOT/backend"
rm -rf .wrangler/state/v3/d1
echo "Resetting local D1..."
for sql in "$ROOT"/scripts/[0-9]*.sql; do
  npx wrangler d1 execute openteochew-db --local --file "$sql"
done
ENTRIES=$(sqlite3 "$ROOT/tmp/openteochew.db" "SELECT COUNT(*) FROM entries;")
if [ "$ENTRIES" -gt 0 ]; then
  sqlite3 "$ROOT/tmp/openteochew.db" ".dump entries pages examples articles sections" | grep "^INSERT" > /tmp/openteochew-local-seed.sql
  npx wrangler d1 execute openteochew-db --local --file /tmp/openteochew-local-seed.sql
  rm -f /tmp/openteochew-local-seed.sql
  npx wrangler d1 execute openteochew-db --local --command "UPDATE sources SET total_entries = (SELECT COUNT(*) FROM entries WHERE entries.source_id = sources.id), total_pages = (SELECT COUNT(*) FROM pages WHERE pages.source_id = sources.id);"

# Sync sources metadata from CSV (overrides hardcoded seed descriptions)
bash "$ROOT/scripts/sync-sources.sh" --local 2>/dev/null
else
  echo "No entries found in local DB — skipping seed."
fi

npx wrangler dev
