# 來源層級欄位來源標記設計

## 問題

有些來源（尤其是純白話字教材）原本根本沒有漢字，目前顯示的漢字是 OpenTeochew 團隊「注」上去的。但讀者無從分辨哪些欄位來自原書、哪些是現代加注的。

現有 `formatField(val, orig)` 只在 `orig` 存在時（校訂場景）顯示「注」badge。當 `orig` 為 NULL（原書根本沒有該欄位）時，不顯示任何標記。

## 決策

在 `sources` 表新增 `original_fields` 欄位——以逗號分隔的欄位名稱列表，標明原書中實際存在的欄位。不在列表中的欄位即為「注」，在該來源的所有詞條上顯示「注」badge。

這是來源層級的屬性，不是逐筆詞條的屬性。同一來源內所有詞條統一適用。

## 範圍

- **追蹤欄位：** `han`、`puj`、`dp`、`en`、`mandarin`、`ja`
- **受影響頁面：** SearchResults（`/chhe/results`）、EntryDetail（`/chhe/entry/:id`）
- **不受影響頁面：** SearchHome（`/chhe`——僅來源列表，無 badge）、ReadHome、SourceViewer、ArticleReader

## 資料模型

### Migration：`scripts/004_add_original_fields.sql`

```sql
ALTER TABLE sources ADD COLUMN original_fields TEXT;
```

- 格式：逗號分隔欄位名稱，例如 `"puj,en"`
- **NULL = 所有欄位皆為原書所有**（向後相容——未設定前不出現 badge）
- 空字串 `""` = 原書什麼都沒有（全部欄位皆為注）

### Seed 資料更新：`scripts/002_seed_sources.sql`

在每個 source 的 INSERT 中加入 `original_fields`。各來源的實際值由使用者依據對各書的認識填寫。範例：

| 來源 | original_fields | 說明 |
|------|----------------|------|
| Handbook of the Swatow Vernacular | `puj,en` | 教材，僅含白話字 + 英文 |
| First Lessons in the Tie-chiw Dialect | `puj,en` | 教材，僅含白話字 + 英文 |
| 英漢汕頭方言口語詞典 | `han,puj,en` | 字典，三者皆有 |
| 汕頭方言音義字典 | `han,puj,en` | 音義字典，三者皆有 |
| 漢英潮州方言字典 | `han,en` | 漢英字典，無白話字 |

## API 變更

### `/api/v1/sources`（routes/sources.ts）

無需改 code——路由使用 `SELECT * FROM sources`，新增欄位後自動回傳。

### `/api/v1/search`（services/search.ts）

**SQL**（約第 137-138 行）：SELECT 加入 `s.original_fields as source_original_fields`。

**Source 物件建構**（約第 173 行）：加入 `original_fields: entry.source_original_fields`。

```js
// Before
source: { id, name, name_zh, year }
// After
source: { id, name, name_zh, year, original_fields }
```

### `/api/v1/entries/:id`（services/entries.ts）

**SQL**（約第 3-4 行）：SELECT 加入 `s.original_fields as source_original_fields` 及 `s.name_zh as source_name_zh`。

**Source 物件建構**（約第 29 行）：加入 `original_fields` 及 `name_zh`。

```js
// Before
source: { id, name, year }
// After
source: { id, name, name_zh, year, original_fields }
```

附帶修復：entry detail 原本缺少 `name_zh` 的不一致問題一併修正。

## 前端變更

### 型別定義

**`web/src/types/source.ts`** — `Source` 新增：
```typescript
original_fields: string | null
```

**`web/src/types/entry.ts`** — `SourceSummary` 新增：
```typescript
original_fields: string | null
name_zh: string | null  // 修正既有不一致
```

### `formatField` 擴充（`web/src/composables/formatField.ts`）

新簽名：
```typescript
export function formatField(val: string | null, orig: string | null, isAnnotated?: boolean)
```

更新邏輯：
```typescript
export function formatField(val, orig, isAnnotated?) {
  if (!val && !orig) return ''

  // 該欄位在原書中不存在（不在 original_fields 列表中）
  if (isAnnotated) {
    return `<span class="rt-annotated"><span class="annotated-badge">注</span>${esc(val || '')}</span>`
  }

  // 該欄位為原書所有——以下邏輯不變
  if (!orig) return esc(val || '')
  const stripped = stripAnno(esc(orig))
  const revised = renderAnno(esc(val || ''))
  const revisedText = revised.replace(/<[^>]*>/g, '').trim()
  return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">注</span>${revised}</span>` : stripped
}
```

### 輔助函式：判斷 `isAnnotated`

呼叫端從來源的 `original_fields` 計算此旗標：

```typescript
function isFieldAnnotated(originalFields: string | null, fieldName: string): boolean {
  if (originalFields === null) return false  // NULL = 全部為原書所有
  const fields = originalFields.split(',').map(f => f.trim())
  return !fields.includes(fieldName)
}
```

欄位名稱對照（DB 欄位 → provenance 欄位名）：
- `han` → `"han"`
- `puj` → `"puj"`
- `dp` → `"dp"`
- `en` → `"en"`
- `mandarin` → `"mandarin"`
- `ja` → `"ja"`

### SearchResults.vue

每個 `group.source` 現在帶有 `original_fields`。更新 `formatField` 呼叫：

```html
<!-- Before -->
<span v-html="formatField(entry.han, entry.han_orig)"></span>
<!-- After -->
<span v-html="formatField(entry.han, entry.han_orig, isFieldAnnotated(group.source.original_fields, 'han'))"></span>
```

所有顯示欄位均須套用：`han`、`puj`、`en`、`dp`。DP 目前直接顯示 `entry.dp`，改為 `formatField(entry.dp, null, isFieldAnnotated(group.source.original_fields, 'dp'))`。由於 DP 永遠不在任何來源的 `original_fields` 中，它將始終顯示「注」badge。

### EntryDetail.vue

Entry 的 source 物件現在帶有 `original_fields`。更新 `fmt` 輔助函式：

```js
// Before
const fmtHan = (e) => fmt(e.han, e.han_orig)
// After——需要 source 層級的 original_fields 資訊
const fmtHan = (e, src) => fmt(e.han, e.han_orig, isFieldAnnotated(src?.original_fields, 'han'))
```

同時適用於當前詞條（`entry.value.source`）及跨來源詞條（`group.source`）。

### CSS（`web/src/styles/tokens.css`）

新增 `.rt-annotated` 及 `.annotated-badge` 樣式，對照既有 `.rt-revised` / `.revised-badge`（第 147-149 行）：

```css
.annotated-badge {
  display: inline-flex; align-items: center; padding: 0 5px;
  border-radius: 3px; background: var(--accent-soft); color: var(--accent);
  font-family: var(--font-mono); font-size: 10px; font-weight: 400;
  line-height: 1.6; flex-shrink: 0; letter-spacing: 0.02em;
}

.rt-annotated {
  display: flex; font-size: 13px; color: var(--muted);
  margin-top: 2px; align-items: center; gap: 4px; font-family: var(--font-body);
}
```

與 `.revised-badge` / `.rt-revised` 完全相同——皆顯示「注」。視覺差異在於上下文：`.rt-annotated` 前面沒有原文，`.rt-revised` 則跟在原文後面。

既有 `.rt-revised` 及 `.revised-badge` 樣式維持不變。

## 資料管線影響

`scripts/full-sync.py` 同步詞條和掃描頁，但不修改 `sources` 表（除了 `total_entries` 和 `total_pages` 計數）。`original_fields` 的值在 seed SQL 中設定，不需從 dataset 同步。

新增來源時，在 INSERT 語句中包含 `original_fields`。

## 測試

1. **手動測試：** Migration + seed 更新後，打開 `/chhe`，搜尋一個出現在純白話字來源（如 source 1）中的詞。確認該來源的詞條漢字欄顯示「注」badge。
2. **回歸測試：** 搜尋一個出現在 `original_fields` 包含 `han` 的來源（如斐姑娘詞典）中的詞。確認除非有校訂，否則不出現新的 badge。
3. **詞條詳情：** 打開一個來自「注」來源的詞條。確認 badge 出現在加注欄位上。確認跨來源分頁顯示正確的逐來源 badge。
4. **NULL 安全性：** 執行 migration 前，確認不出現任何 badge（向後相容）。
