#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/tmp/openteochew.db" ] || [ "$(sqlite3 "$ROOT/tmp/openteochew.db" 'SELECT COUNT(*) FROM entries;')" = "0" ]; then
  bash "$ROOT/init_dev_db.sh"
fi

cd "$ROOT/backend"
rm -rf .wrangler/state/v3/d1
echo "Resetting local D1..."
npx wrangler d1 execute openteochew-db-dev --local --file "$ROOT/scripts/001_initial_schema.sql"
npx wrangler d1 execute openteochew-db-dev --local --file "$ROOT/scripts/002_seed_sources.sql"
sqlite3 "$ROOT/tmp/openteochew.db" ".dump entries pages examples articles sections" | grep "^INSERT" > /tmp/openteochew-local-seed.sql
npx wrangler d1 execute openteochew-db-dev --local --file /tmp/openteochew-local-seed.sql
rm -f /tmp/openteochew-local-seed.sql
npx wrangler d1 execute openteochew-db-dev --local --command "UPDATE sources SET total_entries = (SELECT COUNT(*) FROM entries WHERE entries.source_id = sources.id), total_pages = (SELECT COUNT(*) FROM pages WHERE pages.source_id = sources.id);"

npx wrangler dev
