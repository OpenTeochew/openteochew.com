#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/tmp/openteochew.db" ]; then
  bash "$ROOT/init_dev_db.sh"
fi

cd "$ROOT/backend"
COUNT=$(npx wrangler d1 execute openteochew-db-dev --local --command "SELECT COUNT(*) as c FROM sources;" --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['results'][0]['c'])" 2>/dev/null || echo "0")

if [ "$COUNT" = "0" ]; then
  echo "Initializing local D1..."
  npx wrangler d1 execute openteochew-db-dev --local --file "$ROOT/scripts/001_initial_schema.sql"
  npx wrangler d1 execute openteochew-db-dev --local --file "$ROOT/scripts/002_seed_sources.sql"
  sqlite3 "$ROOT/tmp/openteochew.db" ".dump entries pages examples articles sections" | grep "^INSERT" > /tmp/openteochew-local-seed.sql
  npx wrangler d1 execute openteochew-db-dev --local --file /tmp/openteochew-local-seed.sql
  rm -f /tmp/openteochew-local-seed.sql
  npx wrangler d1 execute openteochew-db-dev --local --command "UPDATE sources SET total_entries = (SELECT COUNT(*) FROM entries WHERE entries.source_id = sources.id), total_pages = (SELECT COUNT(*) FROM pages WHERE pages.source_id = sources.id);"
fi

npx wrangler dev
