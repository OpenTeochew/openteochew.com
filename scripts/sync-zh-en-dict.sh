#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'echo "❌ $(basename "$0") 失敗：第 $LINENO 行（指令：$BASH_COMMAND）" >&2' ERR

usage() {
  cat <<EOF
Usage: $0 [--local|--remote] [--csv PATH]

Sync zh-TW to English dictionary CSV to D1.

Modes:
  --local           Sync to local D1 (default)
  --remote          Sync to remote D1 via wrangler

Options:
  --csv PATH        CSV path (default: tmp/zh-TW_en_dict.csv)
  -h, --help        Show this help
EOF
}

MODE="--local"
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --local|--remote)
      MODE="$1"
      shift
      ;;
    --csv)
      EXTRA_ARGS+=("$1" "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$MODE" = "--remote" ]; then
  ENV_FILE="$ROOT/../.env.dev"
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found (required for --remote)" >&2
    exit 1
  fi
  set -a
  source "$ENV_FILE"
  set +a
fi

cd "$ROOT/.."
python3 scripts/sync-zh-en-dict.py "$MODE" "${EXTRA_ARGS[@]}"
