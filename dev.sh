#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
D1_DIR="$ROOT/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
D1_FILE="$D1_DIR/46c8dc45dd98be78b4f0b287043130727b5a06e0881a6c0f0afdc7d740486b8c.sqlite"

if [ -f "$ROOT/tmp/openteochew.db" ]; then
  mkdir -p "$D1_DIR"
  cp "$ROOT/tmp/openteochew.db" "$D1_FILE"
fi

cd "$ROOT/backend"
npx wrangler dev
