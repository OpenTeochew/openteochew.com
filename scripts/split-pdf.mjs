#!/usr/bin/env node

import { parseArgs } from "node:util";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const { values } = parseArgs({
  options: {
    pdf: { type: "string" },
    "source-id": { type: "string" },
    out: { type: "string" },
  },
  strict: true,
});

if (!values.pdf || !values["source-id"]) {
  console.error("Usage: split-pdf.mjs --pdf <path> --source-id <id> [--out <dir>]");
  process.exit(1);
}

const pdfPath = resolve(values.pdf);
const sourceId = values["source-id"];
const outDir = values.out
  ? resolve(values.out)
  : resolve(import.meta.dirname, "..", "backend", "public", "scans", sourceId);

if (!existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const existing = new Set(
  readdirSync(outDir).filter((f) => f.endsWith(".png"))
);

const pythonScript = `
import fitz
import sys
import os

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
existing = set(sys.argv[3].split(",") if sys.argv[3] else [])

doc = fitz.open(pdf_path)
dpi = 200
zoom = dpi / 72
mat = fitz.Matrix(zoom, zoom)

for i, page in enumerate(doc):
    fname = f"{i+1:03d}.png"
    if fname in existing:
        continue
    pix = page.get_pixmap(matrix=mat)
    pix.save(os.path.join(out_dir, fname))

doc.close()
`;

execFileSync("python3", ["-c", pythonScript, pdfPath, outDir, [...existing].join(",")], {
  stdio: "inherit",
});

const finalFiles = readdirSync(outDir).filter((f) => f.endsWith(".png"));
console.log(`Done: ${finalFiles.length} pages in ${outDir}`);
