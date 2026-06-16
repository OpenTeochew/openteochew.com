#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<EOF
Usage: $0 [--local|--remote] [options]

Sync dataset (CSV + markdown) to D1.

Modes:
  --local           Sync to local D1 (default)
  --remote          Sync to remote D1 via wrangler

Options:
  --source-id N     Source ID (default: 1)
  --hw PATH         Dataset root (default: \$ROOT/../dataset)
  --pages-only      Sync only pages
  --entries-only    Sync only entries (full diff)
  --page-range R    Image-only pages (no OCR/entries). e.g. '1-300' or '300'
  --threshold F     Fuzzy match threshold (default: 0.8)
  --csv PATH        Override CSV path
  --md PATH         Override markdown path
  -h, --help        Show this help

Examples:
  $0 --local
  $0 --remote
  $0 --local --entries-only
  $0 --remote --pages-only
  $0 --local --source-id 4 --page-range 1-300
EOF
}

MODE="--local"
SOURCE_ID=1
HW="$ROOT/../dataset"
PAGE_RANGE_MODE=false
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --local|--remote)
      MODE="$1"
      shift
      ;;
    --source-id)
      SOURCE_ID="$2"
      shift 2
      ;;
    --hw)
      HW="$2"
      shift 2
      ;;
    --pages-only|--entries-only|--threshold=*|--csv|--md)
      EXTRA_ARGS+=("$1")
      if [ "$1" = "--threshold" ] || [ "$1" = "--csv" ] || [ "$1" = "--md" ]; then
        EXTRA_ARGS+=("$2")
        shift
      fi
      shift
      ;;
    --page-range)
      PAGE_RANGE_MODE=true
      EXTRA_ARGS+=("$1" "$2")
      shift 2
      ;;
    --threshold)
      EXTRA_ARGS+=("--match-threshold" "$2")
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
  if [ ! -f "$ROOT/.env.dev" ]; then
    echo "ERROR: $ROOT/.env.dev not found (required for --remote)" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.dev"
  set +a
fi

if [ "$PAGE_RANGE_MODE" = false ] && [ ! -d "$HW" ]; then
  echo "ERROR: dataset not found at $HW" >&2
  echo "Use --hw PATH to specify dataset root" >&2
  exit 1
fi

echo "=== Sync source_id=$SOURCE_ID ($MODE) ==="
echo "  HW:   $HW"
echo

cd "$ROOT"
python3 scripts/sync-source.py \
  --source-id "$SOURCE_ID" \
  --hw "$HW" \
  "$MODE" \
  "${EXTRA_ARGS[@]}"
