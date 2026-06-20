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
  --upload-pdf PATH Upload PDF to R2 before syncing
  --slug SLUG       Book slug for --upload-pdf (default: derived from source-id)
  --dpi N           Render DPI for --upload-pdf (default: 300)
  --force           Re-split and overwrite all pages in R2
  --force-pages R   Re-split and overwrite specific pages only (e.g. 1-20)
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
UPLOAD_PDF=""
SLUG=""
DPI=""
FORCE=""
FORCE_PAGES=""
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
    --upload-pdf)
      UPLOAD_PDF="$2"
      shift 2
      ;;
    --upload-pdf=*)
      UPLOAD_PDF="${1#*=}"
      shift
      ;;
    --slug)
      SLUG="$2"
      shift 2
      ;;
    --slug=*)
      SLUG="${1#*=}"
      shift
      ;;
    --dpi)
      DPI="$2"
      shift 2
      ;;
    --force)
      FORCE="--force"
      shift
      ;;
    --force-pages)
      FORCE_PAGES="--force-pages $2"
      shift 2
      ;;
    --force-pages=*)
      FORCE_PAGES="--force-pages ${1#*=}"
      shift
      ;;
    --skip-existing)
      shift
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
  ENV_FILE="$ROOT/../.env.dev"
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found (required for --remote)" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
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

# Read slug from sources.csv
slug_for_id() {
  python3 -c "
import csv, sys
src_id = int(sys.argv[1])
with open('$ROOT/sources.csv', newline='') as f:
    for row in csv.DictReader(f):
        if int(row['id']) == src_id:
            print(row['slug'] or '')
" "$1" || echo ""
}

if [ -n "$UPLOAD_PDF" ]; then
  if [ ! -f "$UPLOAD_PDF" ]; then
    echo "ERROR: PDF not found: $UPLOAD_PDF" >&2
    exit 1
  fi
  if [ -z "$SLUG" ]; then
    SLUG="$(slug_for_id "$SOURCE_ID")"
    if [ -z "$SLUG" ]; then
      echo "ERROR: cannot derive slug from source_id=$SOURCE_ID, use --slug" >&2
      exit 1
    fi
  fi
  echo "=== Upload PDF to R2 ==="
  echo "  PDF:  $UPLOAD_PDF"
  echo "  Slug: $SLUG"
  echo
  python3 scripts/upload-pdf.py --pdf="$UPLOAD_PDF" --slug="$SLUG" --skip-existing --yes${DPI:+ --dpi "$DPI"} $FORCE $FORCE_PAGES
  echo
fi

cd "$ROOT/.."
python3 scripts/sync-entries.py \
  --source-id "$SOURCE_ID" \
  --hw "$HW" \
  "$MODE" \
  "${EXTRA_ARGS[@]}"
