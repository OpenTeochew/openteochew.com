#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# 印出失敗的行號與指令，避免靜默退出
trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR
step() { echo "▶ $*" >&2; }

# Build local SQLite from dataset if needed
if [ ! -f "$ROOT/tmp/openteochew.db" ] || [ "$(sqlite3 "$ROOT/tmp/openteochew.db" 'SELECT COUNT(*) FROM entries;')" = "0" ]; then
  step "初始化本地 SQLite (init_dev_db.sh)"
  bash "$ROOT/scripts/init_dev_db.sh"
fi

# Build frontend
step "建構前端 (build.sh)"
bash "$ROOT/build.sh"

cd "$ROOT/backend"

# Reset local D1 state
step "重置本地 D1 狀態"
rm -rf .wrangler/state/v3/d1

# Create D1 SQLite file with a no-op query
step "建立 D1 SQLite 預留檔"
npx wrangler d1 execute openteochew-db --local --command "SELECT 1"

# Copy the fully populated SQLite directly into D1 (overwrite + remove stale WAL)
D1_FILE=$(find .wrangler/state/v3/d1/miniflare-D1DatabaseObject -name "*.sqlite" ! -name "metadata.sqlite")
if [ -z "$D1_FILE" ]; then
  echo "❌ 找不到 D1 SQLite 檔（wrangler 可能未正確建立）" >&2
  exit 1
fi
step "複製 openteochew.db → $D1_FILE"
cp -f "$ROOT/tmp/openteochew.db" "$D1_FILE"
rm -f "$D1_FILE-wal" "$D1_FILE-shm"

# Sync source metadata from CSV (inserts source records, updates counts)
step "同步 sources 元數據 (sync-sources.sh)"
bash "$ROOT/scripts/sync-sources.sh" --local

step "啟動 wrangler dev"
npx wrangler dev