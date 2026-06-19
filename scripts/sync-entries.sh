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

# Slug mapping (mirrors sync-entries.py SOURCE_CONFIG)
slug_for_id() {
  case "$1" in
    1) echo "Handbook_of_the_Swatow_Vernacular" ;;
    2) echo "First_Lessons_in_the_Tie_chiw_Dialect" ;;
    3) echo "English_Chinese_Vocabulary_of_the_Vernacular_Or_Spoken_Language_of_Swatow" ;;
    4) echo "A_Pronouncing_and_Defining_Dictionary_of_the_Swatow_Dialect" ;;
    5) echo "A_Chinese_and_English_vocabulary_in_the_Tie_chiu_dialect" ;;
    6) echo "First_Lessons_in_the_Swatow_Dialect" ;;
    7) echo "Handbook_of_the_Swatow_Dialect" ;;
    8) echo "Primary_Lessons_in_Swatow_Grammar" ;;
    9) echo "A_Swatow_Index_to_the_Syllabic_Dictionary_of_Chinese" ;;
    10) echo "Sin_Ieh_Ma_Thai_Hok_Im_Tsur_Tshuan_Tsur" ;;
    11) echo "Ku_ieh_Tshang_Si_Ki_Tshuan_Tsur" ;;
    12) echo "The_Swatow_Syllabary_with_Mandarin_Pronunciations" ;;
    *) echo "" ;;
  esac
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
  python3 scripts/upload-pdf.py --pdf="$UPLOAD_PDF" --slug="$SLUG" --skip-existing --yes
  echo
fi

cd "$ROOT"
python3 scripts/sync-entries.py \
  --source-id "$SOURCE_ID" \
  --hw "$HW" \
  "$MODE" \
  "${EXTRA_ARGS[@]}"
