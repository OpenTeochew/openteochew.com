#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
set -a; source "$ROOT/.env.dev"; set +a

bash build.sh

echo "Deploying to dev..."
cd backend
npx wrangler deploy
echo "Done: https://dev.openteochew.com"
