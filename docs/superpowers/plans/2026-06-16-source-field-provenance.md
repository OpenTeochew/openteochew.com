# 來源層級欄位來源標記 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 sources 表新增 `original_fields` 欄位，標記原書實際包含的欄位；不在列表中的欄位在搜尋結果與詞條詳情頁顯示「注」badge。

**Architecture:** DB 新增一個逗號分隔的 TEXT 欄位 → 後端 SQL JOIN 帶出 → 前端 `formatField` 新增第三參數 `isAnnotated`，由 `isFieldAnnotated` 輔助函式依來源 `original_fields` 判定。既有校訂 badge 邏輯不變。

**Tech Stack:** Cloudflare D1 (SQLite), Hono, Vue 3 + Vite, CSS tokens

**Spec:** `docs/superpowers/specs/2026-06-16-source-field-provenance-design.md`

---

## 檔案結構

| 動作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `scripts/004_add_original_fields.sql` | Migration |
| 修改 | `scripts/002_seed_sources.sql` | Seed 資料加入 `original_fields` |
| 修改 | `backend/src/server/services/search.ts` | 搜尋 SQL + source 物件加入 `original_fields` |
| 修改 | `backend/src/server/services/entries.ts` | 詞條 SQL + source 物件加入 `original_fields`、`name_zh` |
| 修改 | `web/src/types/source.ts` | `Source` 型別加入 `original_fields` |
| 修改 | `web/src/types/entry.ts` | `SourceSummary` 型別加入 `original_fields`、`name_zh` |
| 修改 | `web/src/composables/formatField.ts` | `formatField` 新增 `isAnnotated` 參數 + 匯出 `isFieldAnnotated` |
| 修改 | `web/src/styles/tokens.css` | 新增 `.rt-annotated`、`.annotated-badge` 樣式 |
| 修改 | `web/src/pages/chhe/SearchResults.vue` | 所有欄位傳入 `isAnnotated` |
| 修改 | `web/src/pages/chhe/EntryDetail.vue` | `fmt` 輔助函式傳入 source 資訊 |

---

### Task 1: DB Migration + Seed 資料

**Files:**
- Create: `scripts/004_add_original_fields.sql`
- Modify: `scripts/002_seed_sources.sql`

- [ ] **Step 1: 建立 migration**

Create `scripts/004_add_original_fields.sql`:

```sql
ALTER TABLE sources ADD COLUMN original_fields TEXT;
```

- [ ] **Step 2: 更新 seed 資料**

Modify `scripts/002_seed_sources.sql` — 在 INSERT 欄位列表加入 `original_fields`，並為每筆來源填入對應值：

```sql
INSERT INTO sources (id, name, name_zh, author, year, type, level, status, description, sort_order, original_fields) VALUES
(1, 'Handbook of the Swatow Vernacular', '汕頭話手冊', 'Lim Hiong Seng（林雄成）', '1886', 'textbook', 'SS', 'public_domain', '', 1, 'puj,en,han'),
(2, 'First Lessons in the Tie-chiw Dialect', '潮州話初階', 'William Dean（璘為仁）', '1841', 'textbook', 'SS', 'public_domain', '', 2, 'puj,en,han'),
(3, 'English-Chinese Vocabulary of the Vernacular Or Spoken Language of Swatow', '英漢汕頭方言口語詞典(卓威廉詞典)', 'Rudolf Lechler; Samuel Wells Williams; William Duffus', '1883', 'dictionary', 'SS', 'public_domain', '', 3, 'puj,en'),
(4, 'A Pronouncing and Defining Dictionary of the Swatow Dialect', '汕頭方言音義字典(斐姑娘詞典)', 'Adele Marion Fielde（斐姑娘）', '1883', 'dictionary', 'SS', 'public_domain', '', 4, 'puj,en'),
(5, 'A Chinese and English Vocabulary in the Tie-chiu Dialect', '漢英潮州方言字典(高德字典)', 'Josiah Goddard（高德）', '1847', 'dictionary', 'SS', 'public_domain', '', 5, 'han,en,puj');
```

注意：以上 `original_fields` 值已由使用者確認。

- [ ] **Step 3: 重建本地 DB 驗證**

Run: `HW="$HOME/Documents/Code/hokkien-writing/dataset" ./init_dev_db.sh`
Expected: 無錯誤。啟動 `./dev.sh` 後，查詢 `SELECT id, name, original_fields FROM sources` 應看到 5 筆來源各有 `original_fields` 值。

- [ ] **Step 4: Commit**

```bash
git add scripts/004_add_original_fields.sql scripts/002_seed_sources.sql
git commit -m "feat: add original_fields column to sources table"
```

---

### Task 2: 後端 API — search + entries service

**Files:**
- Modify: `backend/src/server/services/search.ts:137,150,173`
- Modify: `backend/src/server/services/entries.ts:3,29`

- [ ] **Step 1: search.ts — 兩處 SELECT 加入 original_fields**

Modify `backend/src/server/services/search.ts`.

第一處 SELECT（約第 137 行），改為：

```typescript
        `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, s.original_fields as source_original_fields, sec.title as section_title
```

第二處 SELECT（約第 150 行），同樣改為：

```typescript
         `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, s.original_fields as source_original_fields, sec.title as section_title
```

- [ ] **Step 2: search.ts — source 物件加入 original_fields**

約第 173 行，source 物件改為：

```typescript
        source: { id: entry.source_id, name: entry.source_name, name_zh: entry.source_name_zh, year: entry.source_year, original_fields: entry.source_original_fields },
```

- [ ] **Step 3: entries.ts — SELECT 加入 original_fields + name_zh**

Modify `backend/src/server/services/entries.ts`.

SELECT（約第 3 行）改為：

```typescript
    `SELECT e.*, s.name as source_name, s.name_zh as source_name_zh, s.year as source_year, s.original_fields as source_original_fields, sec.title as section_title
```

- [ ] **Step 4: entries.ts — source 物件加入 original_fields + name_zh**

約第 29 行，source 物件改為：

```typescript
    source: { id: entry.source_id, name: entry.source_name, name_zh: entry.source_name_zh, year: entry.source_year, original_fields: entry.source_original_fields },
```

- [ ] **Step 5: 啟動 dev server 驗證 API 回傳**

Run: `./dev.sh`

用 curl 測試搜尋 API：
```bash
curl -s 'http://localhost:8787/api/v1/search?q_puj=a&limit=1' | python3 -m json.tool | grep original_fields
```
Expected: 輸出包含 `"original_fields": "puj,en"` 或類似值。

用 curl 測試詞條 API：
```bash
curl -s 'http://localhost:8787/api/v1/entries/1' | python3 -m json.tool | grep original_fields
```
Expected: 輸出包含 `"original_fields"`。

- [ ] **Step 6: Commit**

```bash
git add backend/src/server/services/search.ts backend/src/server/services/entries.ts
git commit -m "feat: include original_fields in search and entry API responses"
```

---

### Task 3: 前端基礎 — 型別 + formatField + CSS

**Files:**
- Modify: `web/src/types/source.ts`
- Modify: `web/src/types/entry.ts`
- Modify: `web/src/composables/formatField.ts`
- Modify: `web/src/styles/tokens.css`

- [ ] **Step 1: source.ts — Source 型別新增 original_fields**

Modify `web/src/types/source.ts`，在 `Source` interface 中 `sort_order` 後加入：

```typescript
  original_fields: string | null
```

完整 interface 應為：

```typescript
export interface Source {
  id: number
  name: string
  name_zh: string | null
  author: string | null
  year: string | null
  type: 'dictionary' | 'textbook'
  level: string | null
  status: string | null
  description: string | null
  cover_url: string | null
  total_entries: number
  total_pages: number
  sort_order: number
  original_fields: string | null
}
```

- [ ] **Step 2: entry.ts — SourceSummary 型別新增 original_fields + name_zh**

Modify `web/src/types/entry.ts`，`SourceSummary` interface 改為：

```typescript
export interface SourceSummary {
  id: number
  name: string
  name_zh: string | null
  year: string | null
  original_fields: string | null
}
```

- [ ] **Step 3: formatField.ts — 新增 isAnnotated 參數 + isFieldAnnotated 函式**

Modify `web/src/composables/formatField.ts`，完整替換為：

```typescript
const ANNO_RE = /\[([^\]\d]+)\]/g
const ESC_RE = /[&<>"']/g
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function esc(s: string) {
  return s.replace(ESC_RE, c => ESC_MAP[c])
}

export function renderAnno(text: string) {
  return text.replace(ANNO_RE, '<sup class="ocr-anno">$1</sup>')
}

export function stripAnno(text: string) {
  return text.replace(ANNO_RE, '')
}

export function isFieldAnnotated(originalFields: string | null, fieldName: string): boolean {
  if (originalFields === null) return false
  const fields = originalFields.split(',').map(f => f.trim())
  return !fields.includes(fieldName)
}

export function formatField(val: string | null, orig: string | null, isAnnotated?: boolean) {
  if (!val && !orig) return ''

  if (isAnnotated) {
    return `<span class="rt-annotated"><span class="annotated-badge">注</span>${esc(val || '')}</span>`
  }

  if (!orig) return esc(val || '')
  const stripped = stripAnno(esc(orig))
  const revised = renderAnno(esc(val || ''))
  const revisedText = revised.replace(/<[^>]*>/g, '').trim()
  return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">注</span>${revised}</span>` : stripped
}
```

- [ ] **Step 4: tokens.css — 新增 .rt-annotated 和 .annotated-badge 樣式**

Modify `web/src/styles/tokens.css`，在第 149 行（`.entry-puj .rt-revised, .reading-value .rt-revised` 那行）之後加入：

```css
.annotated-badge { display: inline-flex; align-items: center; padding: 0 5px; border-radius: 3px; background: var(--accent-soft); color: var(--accent); font-family: var(--font-mono); font-size: 10px; font-weight: 400; line-height: 1.6; flex-shrink: 0; letter-spacing: 0.02em; }
.rt-annotated { display: flex; font-size: 13px; color: var(--muted); margin-top: 2px; align-items: center; gap: 4px; font-family: var(--font-body); }
.entry-puj .rt-annotated, .reading-value .rt-annotated { display: inline-flex; font-size: inherit; margin-top: 0; }
```

- [ ] **Step 5: Build 驗證無 TypeScript 錯誤**

Run: `cd web && npx vite build`
Expected: Build 成功，無錯誤。

- [ ] **Step 6: Commit**

```bash
git add web/src/types/source.ts web/src/types/entry.ts web/src/composables/formatField.ts web/src/styles/tokens.css
git commit -m "feat: add isAnnotated support to formatField + types + CSS"
```

---

### Task 4: SearchResults.vue 整合

**Files:**
- Modify: `web/src/pages/chhe/SearchResults.vue`

- [ ] **Step 1: 匯入 isFieldAnnotated**

在 `<script setup>` 中，現有 import 行：

```javascript
import { formatField } from '../../composables/formatField'
```

改為：

```javascript
import { formatField, isFieldAnnotated } from '../../composables/formatField'
```

- [ ] **Step 2: 漢字欄 formatField 呼叫加入 isAnnotated**

template 中（約第 54 行）：

```html
<span v-html="formatField(entry.han, entry.han_orig)"></span>
```

改為：

```html
<span v-html="formatField(entry.han, entry.han_orig, isFieldAnnotated(group.source.original_fields, 'han'))"></span>
```

- [ ] **Step 3: PUJ 欄 formatField 呼叫加入 isAnnotated**

template 中（約第 57 行）：

```html
<td class="rt-puj" v-html="formatField(entry.puj, entry.puj_orig)"></td>
```

改為：

```html
<td class="rt-puj" v-html="formatField(entry.puj, entry.puj_orig, isFieldAnnotated(group.source.original_fields, 'puj'))"></td>
```

- [ ] **Step 4: 釋義欄 formatField 呼叫加入 isAnnotated**

template 中（約第 60 行）：

```html
<span v-html="formatField(entry.en, entry.en_orig)"></span>
```

改為：

```html
<span v-html="formatField(entry.en, entry.en_orig, isFieldAnnotated(group.source.original_fields, 'en'))"></span>
```

- [ ] **Step 5: DP 欄改用 formatField**

template 中（約第 58 行）：

```html
<td v-if="group.hasDp" class="rt-dp">{{ entry.dp }}</td>
```

改為：

```html
<td v-if="group.hasDp" class="rt-dp" v-html="formatField(entry.dp, null, isFieldAnnotated(group.source.original_fields, 'dp'))"></td>
```

- [ ] **Step 6: Build 驗證**

Run: `cd web && npx vite build`
Expected: Build 成功。

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/chhe/SearchResults.vue
git commit -m "feat: show annotation badges in search results based on source original_fields"
```

---

### Task 5: EntryDetail.vue 整合

**Files:**
- Modify: `web/src/pages/chhe/EntryDetail.vue`

- [ ] **Step 1: 匯入 isFieldAnnotated**

在 `<script setup>` 中，現有 import 行：

```javascript
import { formatField, renderAnno, stripAnno, esc } from '../../composables/formatField'
```

改為：

```javascript
import { formatField, renderAnno, stripAnno, esc, isFieldAnnotated } from '../../composables/formatField'
```

- [ ] **Step 2: fmt 輔助函式加入 source 參數**

`defTabs` computed 中，現有局部函式（約第 84-94 行）：

```javascript
  const fmt = (val, orig) => {
    if (!val && !orig) return ''
    if (!orig) return esc(val || '')
    const stripped = stripAnno(esc(orig))
    const revised = renderAnno(esc(val || ''))
    const revisedText = revised.replace(/<[^>]*>/g, '').trim()
    return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">注</span>${revised}</span>` : stripped
  }
  const fmtHan = (e) => fmt(e.han, e.han_orig)
  const fmtPuj = (e) => fmt(e.puj, e.puj_orig)
  const fmtEn = (e) => fmt(e.en, e.en_orig)
```

改為：

```javascript
  const fmt = (val, orig, isAnnotated) => {
    if (!val && !orig) return ''
    if (isAnnotated) {
      return `<span class="rt-annotated"><span class="annotated-badge">注</span>${esc(val || '')}</span>`
    }
    if (!orig) return esc(val || '')
    const stripped = stripAnno(esc(orig))
    const revised = renderAnno(esc(val || ''))
    const revisedText = revised.replace(/<[^>]*>/g, '').trim()
    return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">注</span>${revised}</span>` : stripped
  }
  const fmtHan = (e, src) => fmt(e.han, e.han_orig, isFieldAnnotated(src?.original_fields ?? null, 'han'))
  const fmtPuj = (e, src) => fmt(e.puj, e.puj_orig, isFieldAnnotated(src?.original_fields ?? null, 'puj'))
  const fmtEn = (e, src) => fmt(e.en, e.en_orig, isFieldAnnotated(src?.original_fields ?? null, 'en'))
```

注意：這裡 `fmt` 保持為局部函式而不直接呼叫匯出的 `formatField`，因為 EntryDetail 的 `fmt` 在 `defTabs` computed 內部使用，維持局部閉包與現有結構一致。邏輯與 `formatField` 完全相同。

- [ ] **Step 3: 當前詞條的 fmt 呼叫傳入 source**

現有 `currentDef` 建構（約第 96-101 行）：

```javascript
  const currentDef = {
    source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
    text: `<strong>${fmtHan(entry.value)} ${fmtPuj(entry.value)}</strong> — ${fmtEn(entry.value)}`,
    pageNum: entry.value.page_num,
    sourceId: entry.value.source.id
  }
```

改為：

```javascript
  const currentDef = {
    source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
    text: `<strong>${fmtHan(entry.value, entry.value.source)} ${fmtPuj(entry.value, entry.value.source)}</strong> — ${fmtEn(entry.value, entry.value.source)}`,
    pageNum: entry.value.page_num,
    sourceId: entry.value.source.id
  }
```

- [ ] **Step 4: 跨來源詞條的 fmt 呼叫傳入 source**

現有跨來源迴圈中（約第 119-124 行）：

```javascript
        text: `<strong>${fmtHan(e)} ${fmtPuj(e)}</strong> — ${fmtEn(e)}`,
```

改為：

```javascript
        text: `<strong>${fmtHan(e, group.source)} ${fmtPuj(e, group.source)}</strong> — ${fmtEn(e, group.source)}`,
```

- [ ] **Step 5: entry-header 區域 formatField 呼叫也傳入 isAnnotated**

template 中（約第 12 行）：

```html
<div class="entry-char" v-html="formatField(entry.han, entry.han_orig)"></div>
```

改為：

```html
<div class="entry-char" v-html="formatField(entry.han, entry.han_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'han'))"></div>
```

template 中（約第 16 行）：

```html
<div class="entry-puj" v-html="formatField(entry.puj, entry.puj_orig)"></div>
```

改為：

```html
<div class="entry-puj" v-html="formatField(entry.puj, entry.puj_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'puj'))"></div>
```

template 中（約第 18 行）：

```html
<span class="reading-value" v-html="formatField(entry.puj, entry.puj_orig)"></span>
```

改為：

```html
<span class="reading-value" v-html="formatField(entry.puj, entry.puj_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'puj'))"></span>
```

- [ ] **Step 6: DP reading row 改用 formatField**

template 中（約第 19 行）：

```html
<div class="reading-row"><span class="reading-label">DP</span><span class="reading-value">{{ entry.dp }}</span></div>
```

改為：

```html
<div class="reading-row"><span class="reading-label">DP</span><span class="reading-value" v-html="formatField(entry.dp, null, isFieldAnnotated(entry.source?.original_fields ?? null, 'dp'))"></div>
```

- [ ] **Step 7: Build 驗證**

Run: `cd web && npx vite build`
Expected: Build 成功。

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/chhe/EntryDetail.vue
git commit -m "feat: show annotation badges in entry detail based on source original_fields"
```

---

### Task 6: 手動驗證

- [ ] **Step 1: 完整 build**

Run: `./build.sh`
Expected: 前端 build 成功，複製到 `backend/public/` 無錯誤。

- [ ] **Step 2: 啟動 dev server 並驗證搜尋結果**

Run: `./dev.sh`

在瀏覽器打開 `http://localhost:8787/#/chhe`，搜尋一個常見詞（如 `q_puj=a`）。

驗證：
- Source 1/2（Handbook/First Lessons, `puj,en,han`）的詞條：DP 欄顯示「注」badge，漢字/PUJ/釋義欄不顯示（除非有校訂）
- Source 3/4（Lechler/Fielde, `puj,en`）的詞條：漢字欄和 DP 欄顯示「注」badge，PUJ 和釋義欄不顯示
- Source 5（Goddard, `han,en,puj`）的詞條：DP 欄顯示「注」badge，漢字/PUJ/釋義欄不顯示

- [ ] **Step 3: 驗證詞條詳情**

點擊一個來自 Source 3 或 4（Lechler/Fielde, `puj,en`）的詞條進入詳情頁。

驗證：
- 頁首漢字顯示「注」badge（因為 han 不在 original_fields 中）
- 頁首 PUJ 不顯示 badge
- DP 欄顯示「注」badge
- 釋義區的定義中，漢字部分顯示「注」badge
- 若有跨來源比較，各來源的 badge 各自正確

- [ ] **Step 4: 驗證 NULL 安全性**

確認所有來源的 `original_fields` 都已設定，不應有 NULL 值。如果臨時清空某來源的 `original_fields` 為 NULL，該來源的所有欄位都不應顯示「注」badge。

- [ ] **Step 5: 執行既有測試確認無回歸**

Run: `cd backend && npx vitest run`
Expected: 所有測試通過。
