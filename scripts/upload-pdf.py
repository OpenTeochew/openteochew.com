#!/usr/bin/env python3
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TMP_DIR = REPO / "tmp" / "pdf-split"

SLUG_RE = re.compile(r"^[A-Za-z0-9_]+$")

R2_BUCKET = "openteochew-books"


def parse_pages(spec, total):
    """解析页码规范，如 '1,5,8-12' → [1,5,8,9,10,11,12]。1-indexed。"""
    pages = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo_s, hi_s = part.split("-", 1)
            lo, hi = int(lo_s), int(hi_s)
            if lo > hi:
                raise ValueError(f"invalid range '{part}': start > end")
            pages.update(range(lo, hi + 1))
        else:
            pages.add(int(part))
    result = sorted(pages)
    for p in result:
        if p < 1 or p > total:
            raise ValueError(f"page {p} out of range (1-{total})")
    return result


def split_pdf(pdf_path, slug, dpi, quality, force_pages=None):
    import fitz
    from PIL import Image

    out_dir = TMP_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    page_count = len(doc)

    existing = sorted(out_dir.glob("*.webp"))
    if not force_pages and len(existing) == page_count:
        print(f"  Found {page_count} existing WebP files, skipping split")
        doc.close()
        return existing

    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)

    rendered = 0
    reused = 0
    pages = []
    for i, page in enumerate(doc):
        page_num = i + 1
        fpath = out_dir / f"{page_num:04d}.webp"

        if fpath.exists() and (not force_pages or page_num not in force_pages):
            pages.append(fpath)
            reused += 1
            continue

        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img.save(str(fpath), "WEBP", quality=quality)
        pix = None
        img = None
        pages.append(fpath)
        rendered += 1

    doc.close()
    if force_pages:
        print(f"  Rendered: {rendered}, reused cached: {reused}")
    return pages


def get_file_stats(pages):
    total_size = sum(p.stat().st_size for p in pages)
    from PIL import Image
    with Image.open(pages[0]) as img:
        width, height = img.size
    return total_size, width, height


def upload_to_r2(pages, slug, skip_existing, force_pages=None):
    uploaded = 0
    skipped = 0
    failed = 0

    for fpath in sorted(pages):
        r2_key = f"{slug}/{fpath.name}"
        page_num = int(fpath.stem)

        if skip_existing and (not force_pages or page_num not in force_pages):
            check = subprocess.run(
                ["wrangler", "r2", "object", "get", f"{R2_BUCKET}/{r2_key}", "--file", "/dev/null", "--remote"],
                capture_output=True,
            )
            if check.returncode == 0:
                print(f"  skip (exists): {r2_key}")
                skipped += 1
                continue

        result = subprocess.run(
            ["wrangler", "r2", "object", "put", f"{R2_BUCKET}/{r2_key}", "--file", str(fpath), "--remote"],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print(f"  uploaded: {r2_key}")
            uploaded += 1
        else:
            print(f"  FAILED: {r2_key}")
            if result.stderr:
                print(f"    {result.stderr.strip()}")
            failed += 1

    return uploaded, skipped, failed


def main():
    parser = argparse.ArgumentParser(description="Split PDF into WebP and upload to Cloudflare R2")
    parser.add_argument("--pdf", type=Path, required=True, help="PDF file path")
    parser.add_argument("--slug", type=str, required=True, help="Book slug (e.g. Handbook_of_the_Swatow_Vernacular)")
    parser.add_argument("--dpi", type=int, default=300, help="Render DPI (default: 300)")
    parser.add_argument("--quality", type=int, default=85, help="WebP quality 1-100 (default: 85)")
    parser.add_argument("--skip-existing", action="store_true", help="Skip files already in R2")
    parser.add_argument("--pages", type=str, default=None, help="Specific pages to upload (e.g. 23,187 or 1-10,23). 1-indexed. Default: all")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--force", action="store_true", help="Re-split and re-upload all pages, overwriting existing")
    parser.add_argument("--force-pages", type=str, default=None, help="Re-split and overwrite specific pages only, e.g. 1-20 or 1,5,8-12")
    args = parser.parse_args()

    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if not SLUG_RE.match(args.slug):
        print(f"ERROR: invalid slug '{args.slug}'. Use only letters, numbers, underscores.", file=sys.stderr)
        sys.exit(1)

    try:
        import fitz
    except ImportError:
        print("ERROR: PyMuPDF not installed. Run: pip install PyMuPDF", file=sys.stderr)
        sys.exit(1)

    try:
        from PIL import Image
    except ImportError:
        print("ERROR: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
        sys.exit(1)

    print(f"PDF:      {pdf_path}")
    print(f"Slug:     {args.slug}")
    print(f"DPI:      {args.dpi}")
    print(f"Quality:  {args.quality}")
    print()

    if args.force:
        cache_dir = TMP_DIR / args.slug
        if cache_dir.exists():
            print(f"Clearing local cache: {cache_dir}")
            shutil.rmtree(cache_dir)
        args.skip_existing = False

    force_pages_set = None
    if args.force_pages:
        import fitz as _fitz
        _doc = _fitz.open(str(pdf_path))
        _pc = len(_doc)
        _doc.close()
        force_pages_set = set(parse_pages(args.force_pages, _pc))
        cache_dir = TMP_DIR / args.slug
        for p in sorted(force_pages_set):
            fpath = cache_dir / f"{p:04d}.webp"
            if fpath.exists():
                fpath.unlink()
                print(f"  Removed cached: {fpath.name}")

    print("Splitting PDF...")
    pages = split_pdf(pdf_path, args.slug, args.dpi, args.quality, force_pages_set)

    total_size, width, height = get_file_stats(pages)
    avg_size = total_size / len(pages) if pages else 0

    print(f"\nGenerated {len(pages)} pages:")
    print(f"  Resolution: {width}x{height}px")
    print(f"  Total size: {total_size / 1024 / 1024:.1f} MB")
    print(f"  Avg/page:   {avg_size / 1024:.0f} KB")
    print(f"  Output:     {TMP_DIR / args.slug}/")
    print()

    r2_prefix = f"{R2_BUCKET}/{args.slug}/"
    url_base = f"https://static.openteochew.com/{args.slug}/"
    print(f"Upload target: {r2_prefix}")
    print(f"Access URL:    {url_base}0001.webp .. {url_base}{len(pages):04d}.webp")
    print()

    if args.pages:
        try:
            selected = parse_pages(args.pages, len(pages))
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        upload_pages = [p for p in pages if int(p.stem) in set(selected)]
        print(f"Upload set:   {len(upload_pages)} of {len(pages)} pages (selected: {args.pages})")
        print()
    else:
        upload_pages = pages

    if force_pages_set and not args.pages:
        upload_pages = [p for p in upload_pages if int(p.stem) in force_pages_set]
        print(f"Upload set:   {len(upload_pages)} pages (forced)")

    if not args.yes:
        answer = input("Upload to R2? [y/N] ").strip().lower()
        if answer != "y":
            print("Cancelled.")
            sys.exit(0)

    print()
    uploaded, skipped, failed = upload_to_r2(upload_pages, args.slug, args.skip_existing, force_pages_set)

    print()
    print(f"Done: {uploaded} uploaded, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    main()
