#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR

cd "$ROOT"
set -a; source "$ROOT/.env.dev"; set +a

bash build.sh

echo "Deploying..."
cd backend
npx wrangler deploy
echo "Done: https://openteochew.com"
