# PUJ 鍵盤體與 DP 查詢（latn_norm 支持）

## 問題

用戶無法用鍵盤輸入 PUJ 搜尋。現有 PUJ 欄位存的是帶調號的手寫體（如 `tsâ`），用戶在普通鍵盤上無法輸入這些變音符號。DP 欄位雖然 schema 已有，但 sync 腳本從未寫入資料，搜尋形同空轉。

需要：用戶輸入數字調號的鍵盤體（如 `tsa5`），系統能匹配到對應詞條。同時支援 DP 鍵盤輸入（如 `zang1`）。兩者底層共用同一邏輯：轉換為 latn_norm 後匹配。

## 目標

- 用戶在 PUJ 欄位輸入鍵盤體（數字調號），匹配 `latn_norm` 和 `puj` 欄位
- 用戶在 DP 欄位輸入鍵盤體，匹配 `latn_norm` 和 `dp` 欄位
- 支援模糊匹配：`ts↔ch`、`tsh↔chh`、`z↔j`、`ⁿ↔nn` 等變體
- 結果按匹配程度排序：精確 > 前綴 > 子串，同級按欄位長度升序

## 背景：latn_norm 的角色

`latn_norm` 是 dataset 專案中的羅馬字中間格式（pivot），特點：

- 全小寫 + 數字調號（如 `cha5`、`si5-jit8`），不帶變音符號
- 統一 PUJ 的音位分拆：PUJ 在 `a/o/u` 前用 `ts/tsh/z`，在 `i/e` 前用 `ch/chh/j`；latn_norm 一律用 `ch/chh/j`
- 是 PUJ↔DP 轉換的橋樑（dataset 的 `scripts/latn/` 以 latn_norm 為中樞）

三者對應範例：

| latn_norm | PUJ（手寫體） | DP |
|-----------|--------------|-----|
| `chang5` | `tsâng` | `zang⁵` |
| `chhang5` | `tshâng` | `cang⁵` |
| `chin5` | `chîn` | `zin⁵` |
| `pang5` | `pâng` | `bang⁵` |
| `phang5` | `phâng` | `pang⁵` |
| `sur2` | `sṳ́` | `se²` |
| `chap8` | `tsa̍p` | `zab⁸` |

## 設計

### 1. Schema 變更

新增 `latn_norm` 欄位 + 索引（`003_add_latn_norm.sql`）：

```sql
ALTER TABLE entries ADD COLUMN latn_norm TEXT;
CREATE INDEX IF NOT EXISTS idx_entries_latn_norm ON entries(latn_norm);
```

`puj` 和 `dp` 欄位 + 索引已存在於 `001_initial_schema.sql`，無需改動。

### 2. 資料管線

`scripts/full-sync.py` 的 `sync_entries()` 新增寫入 `latn_norm` 和 `dp`。

dataset 的 `teochew.csv` 表頭已包含 `latn_norm, puj, dp, han, ...`，直接從 CSV 讀取對應欄位即可，無需新增轉換步驟。

```python
# full-sync.py sync_entries() 中的 INSERT 語句改為：
INSERT INTO entries (source_id, section_id, han, puj, dp, latn_norm, en, han_orig, puj_orig, en_orig, page_num, sort_order)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

同時更新 `scripts/lib/sql-gen.mjs` 的 `generateSql()` 以包含新欄位。

### 3. 標準化函數（TypeScript）

新增 `backend/src/server/services/normalize.ts`，導出 `normalizeToLatnNorm(input, system)`。

#### PUJ → latn_norm

PUJ 鍵盤體與 latn_norm 幾乎相同，差異是音位分拆。統一規則：

| 輸入（PUJ 鍵盤體） | 條件 | → latn_norm |
|---------------------|------|-------------|
| `ts` | 在 `a/o/u/ua/ue/ou` 前 | `ch` |
| `tsh` | 在 `a/o/u/ua/ue/ou` 前 | `chh` |
| `z` | 在 `a/o/u/ua/ue/ou` 前 | `j` |
| `ⁿ` | 任何位置 | `nn` |
| `ch/chh/j` | 在 `i/e` 前 | 不變（已是 latn_norm 形式） |

以音節為單位處理。用正則匹配音節邊界（連字號 `-` 或空白），對每個音節的聲母做上述映射。

**無歧義**：PUJ 鍵盤體的聲母取決於後接元音，規則確定。

#### DP → latn_norm

DP 與 latn_norm 差異較大，需映射聲母、韻尾、韻母：

**聲母映射（最長匹配優先）：**

| DP | → latn_norm |
|----|-------------|
| `bh` | `b` |
| `gh` | `g` |
| `c` | `chh` |
| `z` | `ch` |
| `r` | `j` |
| `p` | `ph` |
| `t` | `th` |
| `k` | `kh` |
| `b` | `p` |
| `d` | `t` |
| `g` | `k` |

**入聲韻尾映射：**

| DP 尾 | → latn_norm |
|-------|-------------|
| `b` | `p` |
| `d` | `t` |
| `g` | `k` |
| `h` | `h` |

**韻母映射：**

| DP | → latn_norm |
|----|-------------|
| `ao` | `au` |

`ue`/`ie` 在 DP 鍵盤體中已是 `ue`/`ie`，與 latn_norm 相同，無需轉換。

**`e` 的歧義：** DP 鍵盤體的 `e` 有歧義——可能是 DP 的 `e`（→latn_norm `ur`）或 `ê`（→latn_norm `e`）。例如 `se1` 可能是 `sur1`（`sṳ`）或 `se1`（`se`）。

處理方式：函數返回陣列，包含所有可能的 latn_norm 候選。查詢時用 OR 連接所有候選。

```typescript
function normalizeToLatnNorm(input: string, system: 'puj' | 'dp'): string[]
```

PUJ 永遠返回單元素陣列。DP 可能返回多個元素（有 `e` 歧義時）。

### 4. 查詢邏輯

修改 `backend/src/server/services/search.ts`。

#### q_puj 處理

```
input = "tsa5"
normalized = normalizeToLatnNorm("tsa5", "puj") = ["cha5"]

WHERE 條件:
  (latn_norm LIKE '%cha5%' OR puj LIKE '%tsa5%')
```

#### q_dp 處理

```
input = "se1"
normalized = normalizeToLatnNorm("se1", "dp") = ["sur1", "se1"]

WHERE 條件:
  (latn_norm LIKE '%sur1%' OR latn_norm LIKE '%se1%' OR dp LIKE '%se1%')
```

#### 排序（匹配度優先）

在 `ORDER BY` 前加 `CASE WHEN` 分級。tier 數字越小越優先：

```sql
ORDER BY
  CASE
    WHEN latn_norm = ?        THEN 0    -- 精確匹配
    WHEN latn_norm LIKE ?     THEN 1    -- 前綴匹配（input + '%'）
    WHEN latn_norm LIKE ?     THEN 2    -- 子串匹配（'%input%'）
    WHEN puj LIKE ?           THEN 3    -- puj 欄位匹配（僅 q_puj）
    ELSE 4
  END,
  LENGTH(COALESCE(latn_norm, puj, '')),  -- 短詞條優先
  source_id, sort_order
```

DP 查詢同理，把 `puj` 換成 `dp`。多候選時取最低 tier。

#### primaryField 調整

現有代碼用 `primaryField` 決定排序基準欄位。改為：

- `q_puj` 時：`primaryField = 'e.latn_norm'`（主匹配欄位）
- `q_dp` 時：`primaryField = 'e.latn_norm'`

`relevanceOrder` 邏輯改為使用上述 `CASE WHEN` tier。

### 5. 前端

`SearchHome.vue` 已有 PUJ 和 DP 選項，無需結構改動。

placeholders 更新為鍵盤體範例：

```javascript
placeholders = {
  puj: '例: tsa5、chin5',
  dp: '例: zang1、bang5',
  // ...
}
```

### 6. 不在範圍內

- 不做聲調容錯（輸入 `tsa` 不帶調號的模糊匹配）——未來可加
- 不移植完整 Python latn 轉換器到 TypeScript——只實現搜尋所需的單向標準化
- 不改動 Rime 輸入法相關功能
- 前端不新增鍵盤 UI 或輸入法切換

## 成功標準

1. 用戶在 PUJ 欄輸入 `tsa5`，能搜到 PUJ 為 `tsâ` 的詞條
2. 用戶在 PUJ 欄輸入 `chin5`，能搜到 PUJ 為 `chîn` 的詞條
3. 用戶在 DP 欄輸入 `zang1`，能搜到 DP 為 `zang¹` 的詞條
4. 精確匹配（`latn_norm = input`）排在子串匹配之前
5. 原有漢字、英文搜尋不受影響
