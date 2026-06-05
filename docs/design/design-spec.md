# OpenTeochew Design Specification

> This document captures all key design decisions for the OpenTeochew prototype.
> Any AI agent (or human developer) should be able to maintain visual and architectural
> consistency by following this spec.

---

## 1. Project Overview

**OpenTeochew** (潮州話資料庫) is an open-source platform for Teochew (潮州話) language resources. It aggregates dictionaries, corpora, and texts into a unified digital platform.

**Two sub-sites:**
- **Chhe (查)** — Dictionary search engine. Multi-field, multi-script search (PUJ, DP, Hanzi, English, Mandarin, Japanese) with AND-query rows. Results displayed as source-grouped tables. Aggregates all source dictionaries.
- **Thak (讀)** — Reading / browsing interface. View original dictionary scans with OCR overlay, read curated language corpora with three-line (Teochew / PUJ / translation) alignment.

**Tech stack:** Single-page HTML application. No frameworks, no build step. Vanilla JS with hash-based routing. All CSS is inline in a single `<style>` block.

**File:** `index.html` — self-contained, ~1135 lines.

---

## 2. Design System: kami (紙) — Modern Simplified

The visual system is based on the **kami** (紙 / 纸) editorial design system, adapted to be **more modern and clean** than the default kami print-first posture. Key differences from strict kami:

- Sans-serif body text (not serif body) for better screen readability
- Serif reserved for headings and display text only
- Monospace used for PUJ/DP phonetics (linguistic data)
- No section numbers (kami's `01` / `02` pattern is dropped)
- Navigation uses warm-sand active states instead of ink-blue
- More generous spacing on interactive elements

### 2.1 Color Tokens

```css
:root {
  /* Surface */
  --bg: #f5f4ed;             /* parchment — page background, NEVER #fff */
  --surface: #faf9f5;        /* ivory — cards, lifted containers */
  --surface-warm: #e8e6dc;   /* warm sand — buttons, active tabs, badges */

  /* Foreground (4-level warm ramp) */
  --fg: #141413;             /* near-black — primary text */
  --fg-2: #3d3d3a;           /* dark warm — secondary text */
  --muted: #504e49;          /* olive — subtext, captions */
  --meta: #6b6a64;           /* stone — metadata, dates, tertiary */

  /* Border */
  --border: #e8e6dc;         /* primary — card edges, section dividers */
  --border-soft: #e5e3d8;    /* secondary — row separators */

  /* Accent (ink blue — single chromatic color, ≤2 uses per page) */
  --accent: #1b365d;         /* ink blue — logo + primary CTA only */
  --accent-on: #faf9f5;      /* ivory — text on accent bg */
  --accent-soft: #e4ecf5;    /* light tint — focus rings only */
  --accent-active: #142a48;  /* darker ink — hover state for CTA */

  /* Layout */
  --radius: 8px;
  --radius-lg: 12px;
  --container: 1080px;
  --gutter: 32px;
}
```

**Color rules:**
- Background is ALWAYS `#f5f4ed` (parchment). Never pure white.
- Accent (ink blue `#1b365d`) is used at most **twice per page**: the logo and one primary action button.
- Active/hover states on tabs, chips, and filters use `--surface-warm` (#e8e6dc), NOT accent color.
- All grays are warm (R ≈ G > B). No cool blue-grays (`slate-*`, `#f3f4f6`, etc.).
- No second accent color. No gradients. No `backdrop-filter` except the sticky nav blur.

### 2.2 Typography

```css
--font-display: Charter, Georgia, "Noto Serif SC", serif;      /* headings */
--font-body: -apple-system, BlinkMacSystemFont, "PingFang SC", system-ui, sans-serif;  /* body */
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;  /* phonetics, metadata */
```

**Font assignments:**
| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Page title / H1 | `--font-display` | `clamp(36px, 5vw, 56px)` | 500 | Hero headings |
| Section title / H2 | `--font-display` | 20–22px | 500 | |
| Card title / H3 | `--font-display` | 16px | 500 | |
| Body text | `--font-body` | 15–16px | 400 | Default |
| Lead / lede | `--font-body` | 17–18px | 400 | `color: var(--muted)` |
| PUJ / DP phonetics | `--font-mono` | 12–16px | 400 | Always monospace |
| Metadata / source | `--font-mono` | 11–13px | 400–500 | `color: var(--meta)` |
| Entry character | `--font-display` | `clamp(64px, 10vw, 96px)` | 500 | Detail page hero |
| Breadcrumb | `--font-body` | 13px | 400 | `color: var(--muted)` |
| Nav tabs | `--font-body` | 14px | 400/500 | 500 when active |
| Table char cell | `--font-display` | 17px | 500 | `.rt-char` |
| Table PUJ cell | `--font-mono` | 13px | 400 | `.rt-puj` |
| Table DP cell | `--font-mono` | 12px | 400 | `.rt-dp` |
| Table definition | `--font-body` | 13px | 400 | `.rt-def` |
| Table page ref | `--font-mono` | 11px | 400 | `.rt-page` |
| Table header | `--font-mono` | 11px | 500 | uppercase, `--meta` color |

**Weight rules:**
- Display/heading weight: **500 only**. No 600/700/900.
- Body: 400. Strong/emphasis: 500.
- No italic anywhere.

### 2.3 Spacing & Layout

- Container: `max-width: 1080px`, centered, `padding-inline: 32px`
- Section padding: `clamp(48px, 8vw, 88px)` vertical
- Section separator: `border-top: 1px solid var(--border)`
- Card padding: 24–32px
- Card gap: 20–24px
- Grid gap: 10–24px depending on density

### 2.4 Elevation

Three levels only:
| Level | Implementation | Use |
|-------|---------------|-----|
| Flat | none | Default state |
| Ring | `1px solid var(--border)` | Card edges, input borders |
| Whisper | `0 4px 20px rgba(0,0,0,0.06)` | Hover state on cards |

No hard drop shadows. No transforms on hover. No brightness shifts.

### 2.5 Border Radius

- Tags/badges: `4px`
- Buttons/inputs/cards: `8px` (`var(--radius)`)
- Featured cards/containers: `12px` (`var(--radius-lg)`)
- Audio button: `50%` (circle)

---

## 3. Architecture: Hash-Based SPA Router

### 3.1 Route Map

| Hash route | Page ID | Description |
|------------|---------|-------------|
| `#home` (default) | `page-home` | Landing page with dual-site cards |
| `#chhe` | `page-chhe` | Search home — multi-field query form + popular words + sources |
| `#chhe-results` | `page-chhe-results` | Search results in source-grouped tables |
| `#chhe-entry` | `page-chhe-entry` | Single entry detail page |
| `#thak` | `page-thak` | Reading home — dictionary list + corpus list |
| `#thak-read` | `page-thak-read` | Corpus/article reading page |
| `#thak-dict` | `page-thak-dict` | Dictionary scan/OCR viewer |

### 3.2 Routing Mechanism

```javascript
// Each page is a <div class="page" id="page-{route}">
// Router shows/hides pages based on hash:
// - Listens to 'hashchange' event
// - Defaults to 'home' when hash is empty
// - Sets document.title per route
// - Scrolls to top on route change
// - Highlights active nav tab (Chhe or Thak)
```

### 3.3 Shared Elements

- **Top nav** (`<header class="topnav">`): sticky, parchment bg with blur, contains logo + Chhe/Thak tabs + language button
- **Footer** (`<footer class="pagefoot">`): copyright + links, always visible
- **Breadcrumb** (on detail pages): inside the page `<div>`, not shared

---

## 4. Component Patterns

### 4.1 Multi-Field Query Form

The search form uses dynamic query rows. Default shows one row; users click **「+ 新增條件」** to add AND-query rows.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [PUJ/DP/漢字/EN/普通話/日語 ▾]  [placeholder with example]    [×]   │
│ [PUJ/DP/漢字/EN/普通話/日語 ▾]  [placeholder with example]    [×]   │
│                                                                      │
│ [+ 新增條件]                                                         │
│                                                                      │
│              [查 Chhê]  [清除]                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Query row** (`.query-row`): flex row with select + input + remove button
- **Field select** (`.query-select`): custom-styled `<select>` with 6 options:
  - `puj` — PUJ 白話字 (placeholder: `例：tsia̍h, tsuí, hó`)
  - `dp` — DP 潮州拼音 (placeholder: `例：ziah8, zui3, ho3`)
  - `hanzi` — 漢字 (placeholder: `例：食, 潮州, 飯`)
  - `en` — English (placeholder: `例：eat, water, good`)
  - `zh` — 普通話 (placeholder: `例：吃, 潮州, 你好`)
  - `ja` — 日本語 (placeholder: `例：食べる, お茶, 方言`)
- **Placeholder updates dynamically** when the field select changes
- **Remove button** (`.query-remove`): hidden when only 1 row; visible when ≥2 rows
- **Add button** (`.query-add`): appends new row, focuses input, updates remove visibility
- **Search behavior**: exact matches shown first, fuzzy matches after (no explicit toggle)

**JS pattern:**
```javascript
function createQueryRow(field, value) { /* builds .query-row HTML */ }
function updateRemoveVis(container) { /* hides × on last row */ }
function setupQueryRows(containerId, addBtnId) { /* wires select change, remove click, add click */ }
setupQueryRows('searchQueryRows', 'searchAddRow');   // Chhe home
setupQueryRows('resultsQueryRows', 'resultsAddRow'); // Results bar
```

### 4.2 Search Results — Source-Grouped Tables

Results are organized by source dictionary. Each source has its own `<table>` with a header showing source name + count.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Ashmore 1883                                     3 筆                   │
├────────┬──────────┬──────────┬──────────────────┬─────────┬────────────┤
│ 漢字   │ PUJ      │ DP       │ 釋義             │ 頁碼    │            │
├────────┼──────────┼──────────┼──────────────────┼─────────┼────────────┤
│ 食     │ tsia̍h    │ ziah8    │ to eat; to take… │ p. 42   │ ▶          │
├────────┼──────────┼──────────┼──────────────────┼─────────┼────────────┤
│  ·  ·  ·  [ 查看更多 (共 3 筆) ]  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Source group** (`.source-group`): contains `.source-group-head` + `.results-table`
- **Source group head** (`.source-group-head`): flex row with source title + count badge, `border-bottom: 1px solid var(--border)`
- **Results table** (`.results-table`): full-width, `border-collapse: collapse`
  - Columns: 漢字 | PUJ | DP | 釋義 | 頁碼 | (audio)
  - Header: mono 11px, uppercase, `--meta` color, `border-bottom: 1px solid var(--border)`
  - Body rows: `cursor: pointer`, hover `background: var(--surface)`
  - Cell types: `.rt-char` (display 17px), `.rt-puj` (mono 13px), `.rt-dp` (mono 12px `--muted`), `.rt-def` (body 13px, max-width 380px), `.rt-page` (mono 11px `--meta`), `.rt-audio` (28px circle button)
- **Hidden rows** (`.hidden-row`): initially `display: none`, revealed by "查看更多"
- **Show more row** (`.show-more-row`): dashed border button, onclick reveals all `.hidden-row` in same `<tbody>`
- **Results divider** (`.results-divider`): horizontal rule with centered label, used between exact-match and fuzzy-match sections (for future use)

### 4.3 Results Search Bar

Compact version of query form at top of results page:
- Uses same `.query-rows` + `.query-add` pattern
- Pre-fills example query (e.g. 漢字:食 + PUJ:tsia̍h)
- Contains search button and add-row button inline
- Below sticky topnav

### 4.4 Entry Detail Page

Layout:
- **Header**: Giant character + PUJ + reading rows (PUJ/DP/variant) + action buttons
- **Definitions**: Tabbed by source (all / Ashmore / Campbell / modern), each tab shows definition blocks with source citation
- **Examples**: Three-line stack (Teochew / PUJ / translation)
- **Related words**: Grid of small character+PUJ chips

### 4.5 Dictionary Card (Thak Home)

```
┌─────────────────────────────────┐
│ [Cover]  Title                   │
│  Ashmore   Description text      │
│  1883      [S級] [公共領域] —頁  │
└─────────────────────────────────┘
```
- `.dict-card`: flex row, `--surface` bg, cover placeholder (80×110px)

### 4.6 Article Row (Thak Corpus List)

```
語料  潮州話日常問候語                  文本
      收錄常見的潮州話打招呼...
```
- `.article-row`: CSS grid `100px 1fr 80px`, border-top separator
- Hover: `--surface` bg highlight

### 4.7 Reading Page (Thak Read)

Two-column layout:
- **Main** (`1fr`): tags + title + desc + text blocks
- **Sidebar** (`240px`): sticky TOC with intersection observer tracking
- Text blocks use `.phrase-row` grid: `auto auto 1fr` for Teochew / PUJ / translation
- Paragraph blocks use `.paragraph-block` with three stacked `<p>` elements

### 4.8 Dictionary Viewer (Thak Dict)

Two-column layout:
- **Main** (`1fr`): page image placeholder + OCR overlay toggle + page navigation
- **Sidebar** (`280px`): search + entry list for current page
- View toggle: scan vs OCR text (`.view-btn` group)

### 4.9 Interactive Chips / Tabs

All toggle groups follow the same pattern:
```html
<button class="chip active">Active</button>
<button class="chip">Inactive</button>
```
- Inactive: `--border` border, `--muted` text
- Hover: `--fg-2` border, `--fg` text
- Active: `--surface-warm` bg, `--fg` text, `--fg-2` border, `font-weight: 500`

Applied to: filter chips, category tabs, view toggle, definition tabs, nav tabs.

### 4.10 Filter Chips (Results Page)

Source-filter chips above the results:
```html
<div class="filter-chips">
  <button class="filter-chip active">全部來源</button>
  <button class="filter-chip">Ashmore 1883</button>
  <button class="filter-chip">Campbell 1904</button>
  ...
</div>
```
Same toggle pattern as 4.9.

---

## 5. Content Conventions

### 5.1 Language

- **UI language**: 繁體中文 (Traditional Chinese)
- **Dictionary definitions**: English for historical sources (Ashmore, Campbell, Giles), 中文 for modern sources
- **Phonetics**: Always show both PUJ (白話字) and DP (潮州拼音) in mono font
- **Source citations**: `Author · Year · p. XX` or `Author · Year · no. XXXX`

### 5.2 Placeholder Values

Unknown metrics use `—` (em dash), not `N/A` or `0`:
```html
<span class="stat-num">—</span>
<span class="page-num">共 — 頁</span>
```

### 5.3 Search Field Options

The query form supports 6 search fields. Each has a unique placeholder that updates dynamically:

| Value | Label | Placeholder |
|-------|-------|-------------|
| `puj` | PUJ 白話字 | `例：tsia̍h, tsuí, hó` |
| `dp` | DP 潮州拼音 | `例：ziah8, zui3, ho3` |
| `hanzi` | 漢字 | `例：食, 潮州, 飯` |
| `en` | English | `例：eat, water, good` |
| `zh` | 普通話 | `例：吃, 潮州, 你好` |
| `ja` | 日本語 | `例：食べる, お茶, 方言` |

### 5.4 Source Dictionary Data

The prototype includes these dictionaries with real metadata:

| Name | Author | Year | Level | Status |
|------|--------|------|-------|--------|
| A Dictionary of the Swatow Dialect | William Ashmore | 1883 | S | 公共領域 |
| A Swatow Index to the Syllabic Dictionary of Chinese | William Campbell | 1904 | S | 公共領域 |
| English-Chinese Vocabulary... of Swatow | Herbert Giles | 1877 | A | 公共領域 |
| 潮汕方言詞典 | 林倫倫、陳暁楓 | 現代 | A | 待確認 |
| Primer of the Swatow Dialect | William Ashmore | 1883 | B | 公共領域 |
| 潮州話速成 | — | 現代 | B | 待確認 |

### 5.5 Example Content

The prototype uses **食 (tsia̍h / ziah8)** as the primary example word throughout:
- Search results page shows 8 results across 4 sources for 「食」
- Entry detail page shows full definition of 食 tsia̍h
- Dictionary viewer shows page 42 of Ashmore 1883
- Reading page shows greeting phrases that include 食飯

### 5.6 Results Table Structure

Each source group in the results uses this HTML pattern:

```html
<div class="source-group">
  <div class="source-group-head">
    <span class="source-group-title">Ashmore 1883</span>
    <span class="source-group-count">3 筆</span>
  </div>
  <table class="results-table">
    <thead><tr><th>漢字</th><th>PUJ</th><th>DP</th><th>釋義</th><th>頁碼</th><th></th></tr></thead>
    <tbody>
      <tr onclick="location.hash='#chhe-entry'">
        <td class="rt-char">食</td>
        <td class="rt-puj">tsia̍h</td>
        <td class="rt-dp">ziah8</td>
        <td class="rt-def">to eat; to take food; to consume</td>
        <td class="rt-page">p. 42</td>
        <td><button class="rt-audio">▶</button></td>
      </tr>
      <!-- .hidden-row entries (hidden by default) -->
      <tr class="show-more-row">
        <td colspan="6"><button class="show-more-btn">查看更多 (共 N 筆)</button></td>
      </tr>
    </tbody>
  </table>
</div>
```

- First row is always visible (exact match)
- Subsequent rows have `.hidden-row` class, revealed by "查看更多"
- Column header for page reference varies: "頁碼" for page-based sources, "編號" for numbered sources (Campbell)

---

## 6. Responsive Breakpoints

Three breakpoints, matching the CSS in the file:

### `≤ 920px` (Tablet)
- `.source-grid`, `.dict-grid`: 2 columns (from 3 and 2)
- `.read-layout`: single column (TOC moves above content)
- `.viewer-layout`: single column (sidebar below viewer)
- `.entry-sidebar`: no left border, top border instead

### `≤ 768px` (Large phone / small tablet)
- `.results-table`: converts to stacked block layout
  - `thead` hidden
  - Each `tr` becomes a block with vertical padding
  - Each `td` becomes block with no border
  - `.rt-def` max-width removed
- Table becomes scroll-friendly on narrow screens

### `≤ 640px` (Phone)
- All grids collapse to 1 column
- `.nav-inner`: wraps; nav tabs take full width, centered
- Search buttons: full width
- `.entry-header-inner`: stacked (character above info)
- `.def-tabs`: horizontal scroll with `-webkit-overflow-scrolling: touch`
- `.dict-card`: vertical layout
- `.article-row`: single column
- `.phrase-row`: single column
- `.query-row`: wraps; select and input flex to fill width

---

## 7. Interaction Patterns (JavaScript)

### 7.1 Routing
- `window.addEventListener('hashchange', ...)` triggers page visibility swap
- `showPage()` sets: visible page class, active nav tab, document title, scroll to top

### 7.2 Multi-Field Query Form
- `setupQueryRows(containerId, addBtnId)` wires three events:
  1. **Select change** → updates input placeholder from `placeholders` map
  2. **Remove click** → removes row if >1, updates remove button visibility
  3. **Add click** → appends new `.query-row` (default: English field), focuses input
- `createQueryRow(field, value)` builds row HTML with correct select + placeholder
- `updateRemoveVis(container)` hides × on last remaining row
- Form submit on `#searchForm` → navigates to `#chhe-results`
- Word chip clicks → fills first row input + navigates to `#chhe-results`
- Results search button → stays on `#chhe-results`
- Clear button → empties all inputs

### 7.3 Filter Chips (Source Filter)
Same toggle-group pattern: click activates one, deactivates siblings.

### 7.4 Definition Tabs
Like toggle groups, but also shows/hides `.def-panel` elements matching `data-panel` attribute.

### 7.5 Audio Button
Table audio: `onclick="event.stopPropagation();this.classList.toggle('playing')"` — inline handler.
Entry audio: toggles between play (▶) and pause (⏸) SVG icons via `classList.toggle('playing')`.

### 7.6 TOC Tracking (Thak Read)
Uses `IntersectionObserver` with `rootMargin: '-20% 0px -60% 0px'` to highlight the currently visible section in the sidebar TOC.
TOC link clicks use `scrollIntoView` within the page (not hash routing, to avoid page switch).

### 7.7 OCR Toggle (Thak Dict)
Toggles `.visible` class on `.ocr-overlay`, switching between scan placeholder and OCR text view.

### 7.8 Show More (Results Tables)
Inline onclick handler on `.show-more-btn`:
```javascript
this.closest('tbody').querySelectorAll('.hidden-row').forEach(function(r){r.style.display='table-row'});
this.closest('tr').style.display='none'
```

---

## 8. CSS Class Reference

### Layout
| Class | Purpose |
|-------|---------|
| `.container` | Max-width 1080px, centered, 32px gutter |
| `.section` | Vertical padding `clamp(48px, 8vw, 88px)` |
| `.page` / `.page.active` | Route visibility toggle |
| `.topnav` | Sticky nav with blur |
| `.pagefoot` | Footer with border-top |

### Query Form
| Class | Purpose |
|-------|---------|
| `.query-form` | Form container, max-width 640px, centered |
| `.query-rows` | Vertical stack of query rows |
| `.query-row` | Flex row: select + input + remove button |
| `.query-select` | Custom-styled select with chevron background-image |
| `.query-input` | Text input with focus ring |
| `.query-remove` | × button, `.hidden` when only 1 row |
| `.query-add` | "+ 新增條件" dashed button |
| `.search-btn` | Primary CTA (ink blue) |
| `.search-clear` | Ghost clear button |

### Results Table
| Class | Purpose |
|-------|---------|
| `.source-group` | One table per source dictionary |
| `.source-group-head` | Source title + count, border-bottom |
| `.results-table` | Full-width data table |
| `.rt-char` | 漢字 cell (display serif 17px) |
| `.rt-puj` | PUJ cell (mono 13px) |
| `.rt-dp` | DP cell (mono 12px, muted) |
| `.rt-def` | Definition cell (13px, max-width 380px) |
| `.rt-page` | Page reference cell (mono 11px, meta) |
| `.rt-audio` | Audio play button (28px circle) |
| `.hidden-row` | Hidden row, revealed by "查看更多" |
| `.show-more-row` | Row containing "查看更多" button |
| `.show-more-btn` | Dashed border toggle button |

### Other Components
| Class | Purpose |
|-------|---------|
| `.word-chip` | Hot word tile (char + PUJ) |
| `.source-card` | Dictionary source card on Chhe home |
| `.dict-card` | Dictionary card on Thak home (cover + info) |
| `.article-row` | Corpus article row (grid 100px 1fr 80px) |
| `.phrase-row` | Three-column phrase (Teochew / PUJ / translation) |
| `.def-tabs` / `.def-tab` | Source-filtered definition tabs |
| `.def-panel` | Definition content panel |
| `.entry-char` | Giant character on detail page |
| `.toc-sidebar` | Sticky TOC on reading page |

---

## 9. File Structure (if split)

If the SPA is later split into multiple files:

```
openteochew/
├── index.html              ← overview/launcher
├── chhe.html              ← search home
├── chhe-results.html      ← search results
├── chhe-entry.html        ← entry detail
├── thak.html               ← reading home
├── thak-read.html          ← corpus reading
├── thak-dict.html          ← dictionary viewer
├── DESIGN_SPEC.md          ← this file
└── (planning doc).md       ← project plan
```

---

## 10. What to Maintain

When adding new pages, components, or features:

1. **Use the existing `:root` tokens.** Never hardcode hex values outside `:root`.
2. **Accent ≤ 2 per page.** Only logo + one primary CTA may use `--accent`.
3. **Active/hover states use `--surface-warm`**, not accent color.
4. **Phonetics always in `--font-mono`**, headings always in `--font-display`**.
5. **Cards use `--surface` bg** (ivory), page uses `--bg` (parchment). Never `#fff`.
6. **No emoji icons.** Use inline SVG for all icons (search, audio, book, etc.).
7. **Follow the toggle/chip pattern** for any new filter/tab/control group.
8. **New routes must be added** to the `pages` object, `showPage()` function, and `titles` map.
9. **Responsive**: test at 360px, 640px, 768px, 920px, 1080px, 1440px.
10. **Content must be specific and real.** Use `—` for unknown values, not invented metrics.
11. **Search results use source-grouped tables**, not card lists. Follow the `.results-table` pattern.
12. **Query forms use the multi-row pattern** with `setupQueryRows()`. Add new search fields to both the `placeholders` map and the select options.
13. **No explicit exact/fuzzy toggle.** Results automatically show exact matches first, fuzzy matches after.
14. **"查看更多" pattern**: first row visible, rest `.hidden-row`, toggle button in `.show-more-row`.
