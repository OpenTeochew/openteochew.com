# 原冊功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓搜索結果和詞條詳情的每個詞條有「原冊」按鈕，點擊跳到 SourceViewer 定位到原書對應頁面圖片。

**Architecture:** PDF 分割為單頁 PNG 靜態文件 → 從維基文庫抓取 section→page_num 映射 → 前端加「原冊」連結按鈕跳轉到 SourceViewer 頁面。

**Tech Stack:** pymupdf (PDF分割), Node.js fetch (維基文庫抓取), D1 SQL (更新 page_num), Vue 3 (前端)

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `scripts/split-pdf.mjs` | PDF → 單頁 PNG |
| Create | `scripts/sync-wikisource.mjs` | 從維基文庫抓取頁碼映射 + OCR |
| Create | `scripts/lib/wikisource-parse.mjs` | 維基文庫 HTML 解析工具 |
| Modify | `backend/src/server/services/search.ts` | 搜索結果加 section title |
| Modify | `backend/src/server/services/entries.ts` | 詞條詳情加 section title |
| Modify | `web/src/pages/chhe/SearchResults.vue` | 每行加「原冊」按鈕 |
| Modify | `web/src/pages/chhe/EntryDetail.vue` | def-block 加「原冊」連結 |
| Modify | `web/src/pages/thak/SourceViewer.vue` | 支持實際圖片 + page query |
| Modify | `web/src/styles/tokens.css` | 「原冊」按鈕樣式 |

---

### Task 1: PDF 分割腳本

**Files:**
- Create: `scripts/split-pdf.mjs`

- [ ] **Step 1: 創建 split-pdf.mjs**

```js
#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
let pdfPath = ''
let sourceId = 0
let outDir = ''

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pdf' && args[i + 1]) { pdfPath = args[++i]; continue }
  if (args[i] === '--source-id' && args[i + 1]) { sourceId = Number(args[++i]); continue }
  if (args[i] === '--out' && args[i + 1]) { outDir = args[++i]; continue }
}

if (!pdfPath || !sourceId) {
  console.error('Usage: split-pdf.mjs --pdf <path> --source-id <id> [--out <dir>]')
  process.exit(1)
}

if (!outDir) outDir = `backend/public/scans/${sourceId}`

if (!existsSync(pdfPath)) {
  console.error(`ERROR: PDF not found: ${pdfPath}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const pyScript = `
import fitz, sys
doc = fitz.open(sys.argv[1])
print(f"PDF has {len(doc)} pages")
for i, page in enumerate(doc):
    out = f"{sys.argv[2]}/{i+1:03d}.png"
    if __import__('os').path.exists(out):
        continue
    pix = page.get_pixmap(dpi=200)
    pix.save(out)
    if (i+1) % 50 == 0:
        print(f"  Processed {i+1}/{len(doc)} pages")
doc.close()
print(f"Done: {len(doc)} pages")
`

const tmpPy = `/tmp/split-pdf-${Date.now()}.py`
import { writeFileSync, unlinkSync } from 'node:fs'
writeFileSync(tmpPy, pyScript)

try {
  execSync(`python3 "${tmpPy}" "${pdfPath}" "${outDir}"`, { stdio: 'inherit' })
} finally {
  try { unlinkSync(tmpPy) } catch {}
}
```

- [ ] **Step 2: 執行 PDF 分割**

```bash
node scripts/split-pdf.mjs --pdf "/Users/lim/Documents/hw-onedrive/book/Handbook_of_the_Swatow_Vernacular.pdf" --source-id 1
```

Expected: `backend/public/scans/1/001.png` ... `304.png` (304 files)

- [ ] **Step 3: 驗證輸出**

```bash
ls backend/public/scans/1/ | wc -l
ls -lh backend/public/scans/1/001.png
```

Expected: 304 files, each ~200-400KB PNG at 200dpi

---

### Task 2: 維基文庫同步腳本

**Files:**
- Create: `scripts/lib/wikisource-parse.mjs`
- Create: `scripts/sync-wikisource.mjs`

- [ ] **Step 1: 創建維基文庫 HTML 解析工具**

`scripts/lib/wikisource-parse.mjs`:

```js
export function parseSubpageLinks(html) {
  const re = /href="\/wiki\/Handbook_of_the_Swatow_Vernacular\/([^"#]*)"/g
  const links = new Set()
  let m
  while ((m = re.exec(html))) {
    links.add(decodeURIComponent(m[1]))
  }
  return [...links]
}

export function parsePageMarkers(html) {
  const re = /data-page-number="([^"]*)"[^>]*data-page-index="([^"]*)"/g
  const markers = []
  let m
  while ((m = re.exec(html))) {
    markers.push({ pageNumber: m[1], pageIndex: Number(m[2]) })
  }
  return markers
}

export function extractSectionPageMap(subpagesWithMarkers) {
  const sectionMap = new Map()

  for (const { subpage, markers } of subpagesWithMarkers) {
    if (markers.length === 0) continue
    const firstPage = markers[0].pageNumber
    const lastPage = markers[markers.length - 1].pageNumber
    if (/^\d+$/.test(firstPage)) {
      sectionMap.set(subpage, {
        startPage: Number(firstPage),
        endPage: Number(lastPage),
        startPdfPage: markers[0].pageIndex,
        endPdfPage: markers[markers.length - 1].pageIndex,
      })
    }
  }

  return sectionMap
}
```

- [ ] **Step 2: 創建 sync-wikisource.mjs 主腳本**

`scripts/sync-wikisource.mjs`:

```js
#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { parseSubpageLinks, parsePageMarkers, extractSectionPageMap } from './lib/wikisource-parse.mjs'

const BASE = 'https://en.wikisource.org/wiki/Handbook_of_the_Swatow_Vernacular'

async function fetchHtml(url) {
  const res = await fetch(url)
  return res.text()
}

const sectionToSubpage = {
  'Lesson I.': 'Introductory',
  'Lesson II.': 'Introductory',
  'Lesson III. Exercises.': 'Introductory',
  'Lesson IV. A List of Introductory Verbs.': 'A_List_of_Introductory_Verbs',
  'Lesson V.': 'Exercises_(Lesson_V)',
  'Lesson VI. A List of Introductory Adjectives.': 'A_List_of_Introductory_Adjectives',
  'Lesson VII.': 'Exercises_(Lesson_VII)',
  'Lesson VIII. numeral.': 'Numeral',
  'Lesson IX.': 'Tones,_Hyphens',
  'Lesson X.': 'Grammar',
  'section I.': 'Grammar',
  'section II.': 'Grammar',
  'section III.': 'Grammar',
  'section IV.': 'Grammar',
  'section V.': 'Grammar',
  'present tense.': 'Grammar',
  'past tense.': 'Grammar',
  'perfect tense.': 'Grammar',
  'future tense.': 'Grammar',
  'potential mood.': 'Grammar',
  'the comparative degree.': 'Grammar',
  'the superlative degree.': 'Grammar',
  'Lesson XI.': 'Time_generally',
  'Lesson XII.': 'A_Building_%26c.',
  'Lesson XIII.': 'Human_Body_%26c.',
  'Lesson XIV. household furniture &c.': 'Household_Furniture_%26c.',
  'Dining Room.': 'Household_Furniture_%26c.',
  'Bed Room.': 'Household_Furniture_%26c.',
  'Kitchen.': 'Household_Furniture_%26c.',
  'Lesson XV. garden.': 'Garden',
  'Lesson XVI. a list of words used in cooking.': 'A_List_of_Words_used_in_Cooking',
  'Lesson XVII.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Provisions.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Fish.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Vegetables.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Fruit.': 'Provisions,_Fish,_Vegetable_and_Fruit',
  'Lesson XVIII. on dress.': 'On_Dress',
  'Lesson XIX. nautical.': 'Nautical',
  'Lesson XX. medical.': 'Medical',
  'Lesson XXI.': 'Commercial',
  'Commercial.': 'Commercial',
  'Piece-goods.': 'Commercial',
  'Mineral &c.': 'Commercial',
  'Miscellaneous Articles.': 'Commercial',
  'Carpentry.': 'Commercial',
  'Tailoring.': 'Commercial',
  'Accounts.': 'Commercial',
  'Monetary.': 'Commercial',
  'A List of words used in Commerce.': 'Commercial',
  'Weights and measures.': 'Commercial',
  'Lesson XXII. judicial.': 'Judicial',
  'Lesson XXIII. hostilities.': 'Hostilities',
  'Lesson XXIV. religious.': 'Religious',
  'Lesson XXV. relationships.': 'Relationships',
  'Lesson XXVI. a list of animals and birds.': 'A_List_of_Animals_and_Birds',
  'Lesson XXVII. a list of classifiers.': 'A_List_of_Classifiers',
  'Lesson XXVIII. Notes—Nautical.': 'Notes%E2%80%94Nautical',
  'Lesson XXIX. Notes—Medical.': 'Notes%E2%80%94Medical',
  'Lesson XXX. Notes—Commercial.': 'Notes%E2%80%94Commercial',
  'Lesson XXXI. Notes—Judicial.': 'Notes%E2%80%94Judicial',
  'Lesson XXXII. Notes—Hostilities.': 'Notes%E2%80%94Hostilities',
  'Lesson XXXIII. Notes—Religious.': 'Notes%E2%80%94Religious',
  'A Dictionary of some of the more important words in the Swatow dialect.': 'A_Dictionary_of_some_of_the_more_important_words_in_the_Swatow_dialect',
  'External.': 'Human_Body_%26c.',
}

async function main() {
  console.log('Fetching main page...')
  const mainHtml = await fetchHtml(BASE)

  const subpageSet = new Set(Object.values(sectionToSubpage))
  console.log(`Need to fetch ${subpageSet.size} unique subpages`)

  const subpagesWithMarkers = []
  for (const subpage of subpageSet) {
    const url = `${BASE}/${subpage}`
    console.log(`  Fetching ${subpage}...`)
    try {
      const html = await fetchHtml(url)
      const markers = parsePageMarkers(html)
      subpagesWithMarkers.push({ subpage, markers })
      console.log(`    Found ${markers.length} page markers: ${markers.map(m => m.pageNumber).join(', ')}`)
    } catch (e) {
      console.error(`    ERROR fetching ${subpage}: ${e.message}`)
    }
  }

  const sectionPageMap = extractSectionPageMap(subpagesWithMarkers)
  console.log(`\nMapped ${sectionPageMap.size} sections to page numbers`)

  const statements = []

  for (const [sectionTitle, subpage] of Object.entries(sectionToSubpage)) {
    const info = sectionPageMap.get(subpage)
    if (!info) {
      console.log(`  SKIP (no page markers): ${sectionTitle}`)
      continue
    }
    statements.push(
      `UPDATE entries SET page_num = ${info.startPage} WHERE source_id = 1 AND section_id = (SELECT id FROM sections WHERE source_id = 1 AND title = '${sectionTitle.replace(/'/g, "''")}');`
    )
  }

  statements.push(
    `UPDATE sources SET total_pages = 304 WHERE id = 1;`
  )

  console.log(`\nGenerated ${statements.length} SQL statements`)

  const tmpFile = `/tmp/sync-wikisource-${Date.now()}.sql`
  writeFileSync(tmpFile, statements.join('\n'))
  console.log(`Executing SQL...`)
  execSync(`npx wrangler d1 execute openteochew-db --local --file=${tmpFile}`, { stdio: 'inherit' })
  try { unlinkSync(tmpFile) } catch {}
  console.log('Sync complete.')
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: 執行同步腳本**

```bash
node scripts/sync-wikisource.mjs
```

Expected: Fetches ~25 unique subpages, generates ~54 UPDATE statements, updates entries.page_num

- [ ] **Step 4: 驗證 page_num 已填充**

```bash
cd backend && npx wrangler d1 execute openteochew-db --local --command="SELECT page_num, COUNT(*) as cnt FROM entries WHERE source_id = 1 GROUP BY page_num ORDER BY page_num"
```

Expected: All entries now have page_num values

---

### Task 3: 後端 — 搜索結果返回 section title

**Files:**
- Modify: `backend/src/server/services/search.ts`
- Modify: `backend/src/server/services/entries.ts`

- [ ] **Step 1: 修改 search.ts，JOIN sections 表取 section title**

在 `searchEntries` 函數中修改 SELECT 和 JOIN：

將 `SELECT e.*, s.name as source_name, s.year as source_year` 改為：
`SELECT e.*, s.name as source_name, s.year as source_year, sec.title as section_title`

將 `JOIN sources s ON e.source_id = s.id` 後加：
`LEFT JOIN sections sec ON e.section_id = sec.id`

在 entries push 中加：
```ts
source_id: entry.source_id,
section_title: entry.section_title,
```

- [ ] **Step 2: 修改 entries.ts，JOIN sections 表取 section title**

在 `getEntryById` 中做同樣的 JOIN 修改，返回值加 `section_title`。

---

### Task 4: 前端 — SourceViewer 支持實際圖片 + page query

**Files:**
- Modify: `web/src/pages/thak/SourceViewer.vue`

- [ ] **Step 1: 修改 SourceViewer 支持接收 page query 參數**

在 `<script setup>` 中：

```js
import { useRoute } from 'vue-router'
const route = useRoute()

// 初始化 pageNum 從 route.query.page
const pageNum = ref(Number(route.query.page) || 1)

// watch pageNum 變化時同步 URL
watch(pageNum, (val) => {
  router.replace({ query: { ...route.query, page: val } })
})
```

- [ ] **Step 2: 替換假圖片為真實圖片**

將 `<div class="page-image">` 中的佔位 SVG 替換為：

```html
<div class="page-image">
  <img v-if="pageImageUrl" :src="pageImageUrl" :alt="`第 ${pageNum} 頁`" style="width:100%;height:100%;object-fit:contain;">
  <template v-else>
    <svg class="page-image-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4M7 11h10M7 15h6"/></svg>
    <p class="page-image-text">原書掃描頁面<br><span style="font-size:12px">第 {{ pageNum }} 頁 · {{ source.name }}</span></p>
  </template>
</div>
```

加 computed：
```js
const pageImageUrl = computed(() => {
  if (!source.value) return null
  return `/scans/${source.value.id}/${String(pageNum.value).padStart(3, '0')}.png`
})
```

- [ ] **Step 3: 驗證 SourceViewer**

```bash
./build.sh && ./dev.sh
```

訪問 `http://localhost:8787/#/thak/source/1?page=42`，應看到原書第 42 頁圖片。

---

### Task 5: 前端 — SearchResults 加「原冊」按鈕

**Files:**
- Modify: `web/src/pages/chhe/SearchResults.vue`
- Modify: `web/src/styles/tokens.css`

- [ ] **Step 1: 在 SearchResults 表格每行加「原冊」連結**

在 `<td class="rt-page">` 後面加一列：

```html
<th>原冊</th>
```

```html
<td class="rt-src">
  <router-link
    v-if="entry.page_num"
    :to="{ name: 'SourceViewer', params: { id: entry.source_id || group.source.id }, query: { page: entry.page_num } }"
    class="src-link"
    title="查看原書"
    target="_blank"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
  </router-link>
</td>
```

- [ ] **Step 2: 加 CSS 樣式**

在 tokens.css 加：

```css
.rt-src { width: 40px; text-align: center; }
.src-link { display: inline-grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); transition: all 150ms; }
.src-link:hover { border-color: var(--fg-2); color: var(--fg); background: var(--surface); }
```

---

### Task 6: 前端 — EntryDetail 加「原冊」連結

**Files:**
- Modify: `web/src/pages/chhe/EntryDetail.vue`

- [ ] **Step 1: 在 def-source 行加「原冊」連結**

修改 def-source 顯示：

```html
<p class="def-source">
  {{ d.source }}
  <router-link v-if="d.pageNum" :to="{ name: 'SourceViewer', params: { id: d.sourceId }, query: { page: d.pageNum } }" class="src-link-inline" target="_blank">原冊</router-link>
</p>
```

在 defTabs computed 中，每個 def 對象加 `pageNum` 和 `sourceId`：

```js
const currentDef = {
  source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
  text: `...`,
  pageNum: entry.value.page_num,
  sourceId: entry.value.source.id,
}
```

cross-source groups 的 def 也加 `pageNum: e.page_num, sourceId: group.source.id`。

- [ ] **Step 2: 加 CSS**

```css
.src-link-inline { font-size: 12px; color: var(--accent); margin-left: 8px; }
.src-link-inline:hover { text-decoration: underline; }
```

---

### Task 7: 整合測試 + build 驗證

- [ ] **Step 1: 完整 build**

```bash
./build.sh
```

Expected: 無錯誤

- [ ] **Step 2: 啟動 dev 驗證**

```bash
./dev.sh
```

驗證：
1. 搜索「食」→ 結果表格有「原冊」圖標列
2. 點擊「原冊」→ 跳轉到 SourceViewer 顯示對應頁面圖片
3. 點擊詞條詳情 → def-source 旁有「原冊」連結
4. SourceViewer 可翻頁瀏覽

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add 原冊 (original book) button linking entries to scanned pages"
```
