# 版權聲明頁設計

## 問題

現有版權聲明將三個不同層次的內容一刀切為「數據 CC0」，法律上和倫理上都有問題：

1. **原書文獻** — 19-20 世紀古籍，已進入公共領域（無問題）
2. **掃描影像** — 版權因來源而異。部分由 Dr. Kenny Wang 數位化，影像版權歸其所有；部分來自 Internet Archive / Google Books / Wikisource 等機構
3. **結構化數據** — 詞條、OCR 校訂，為團隊整理成果（可 CC0）

README 和 AboutPage 籠統標註「數據 CC0」，未區分上述層次。需要一個專門的版權聲明頁，逐來源列出版權情況。

## 決策

採用分層版權模型，在 `sources` 表新增結構化欄位追蹤掃描影像版權，新建 `/license` 頁面動態渲染版權明細。

## 資料模型

### Migration：`scripts/004_add_scan_source.sql`

```sql
ALTER TABLE sources ADD COLUMN scan_source TEXT;
ALTER TABLE sources ADD COLUMN proofread_note TEXT;
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `scan_source` | TEXT, nullable | 掃描影像來源與版權的描述性文字（如 `"由 Google 數位化自哈佛大學藏書，經 Wikisource 提供"`、`"由 Dr. Kenny Wang 數位化，影像著作權歸其所有"`） |
| `proofread_note` | TEXT, nullable | 校注說明，描述性文字（如 `"由 Lim Tsunhua 初步校訂，張堅博士終審"`）。（**暫不填充數據、暫不顯示**，留待後續確定） |

使用描述性文字而非結構化枚舉，因為掃描者與分享者可能不是同一人，關係多樣，自由文字最能準確表達。

現有 `status` 欄位（原書版權狀態，全為 `public_domain`）保持不變。

### CSV 回填：`scripts/sources.csv`

新增兩列：`scan_source`、`proofread_note`。37 個來源的 `scan_source` 描述（`proofread_note` 全部留空）：

| ID | scan_source |
|----|-------------|
| 1 | 由康奈爾大學圖書館藏書經 Internet Archive 數位化，Wikisource 提供 |
| 2 | 由哈佛大學藏書經 Google 數位化，Wikisource 提供 |
| 3 | 由 Google 數位化，Wikisource 提供 |
| 4 | 由 Internet Archive 在微軟資助下數位化，Wikisource 提供 |
| 5 | Wikisource 提供 |
| 6 | 由哥倫比亞大學藏書經 Google 數位化，Internet Archive 及 Wikisource 提供 |
| 7 | 由 Google 數位化，Wikisource 提供 |
| 8 | Internet Archive 數位化，Wikisource 提供 |
| 9 | — |
| 10 | 由澳洲雪梨 Dr. Kenny Wang 數位化，影像著作權歸其所有 |
| 11 | 由 Dr. Kenny Wang 數位化，哈佛燕京圖書館及澳洲國立圖書館藏，影像著作權歸 Dr. Kenny Wang 所有 |
| 12 | — |
| 13 | — |
| 14 | — |
| 15 | — |
| 16 | — |
| 17 | — |
| 18 | Internet Archive 數位化，Wikisource 及中國哲學書電子化計劃提供 |
| 19 | 東京大學東洋文化研究所藏，中國哲學書電子化計劃提供 |
| 20 | 由 Google 數位化 |
| 21 | Harvard Yenching Library 藏，FHL.net 提供 |
| 22 | 澳洲國立圖書館藏，由 Dr. Kenny Wang 翻拍數位化，影像著作權歸其所有 |
| 23 | Harvard Yenching Library 藏（Spillett 943），FHL.net 及 Google Books 提供 |
| 24 | 澳洲國立圖書館藏，由 Dr. Kenny Wang 翻拍數位化，影像著作權歸其所有 |
| 25 | Harvard Yenching Library 藏（Spillett 956） |
| 26 | 澳洲國立圖書館藏，由 Dr. Kenny Wang 翻拍數位化，影像著作權歸其所有 |
| 27 | — |
| 28 | — |
| 29 | — |
| 30 | — |
| 31 | Wikimedia Commons 提供 |
| 32 | — |
| 33 | — |
| 34 | — |
| 35 | — |
| 36 | Wikimedia Commons 提供 |
| 37 | 中國國家圖書館藏，Wikimedia Commons 提供 |

### 同步腳本：`scripts/sync-sources.sh`

`FIELDS` 列表新增三個欄位：

```python
FIELDS = ["id","name","name_zh","author","year","type","level","status","description","sort_order","original_fields","scan_source","proofread_note"]
```

## API 變更

### `/api/v1/sources`（routes/sources.ts）

無需改 code — 路由使用 `SELECT * FROM sources`，新欄位自動回傳。

## 前端變更

### 型別定義：`web/src/types/source.ts`

`Source` interface 新增：

```typescript
scan_source: string | null
proofread_note: string | null
```

### 新頁面：`web/src/pages/LicensePage.vue`

路由 `/license`，風格與 AboutPage / PrivacyPage 一致（`<script setup>` + `useSimplified` + `tokens.css` 類名）。

**頁面結構（三段式）：**

**第一段：總覽 — 三層版權模型**

| 層次 | 版權 |
|------|------|
| 原書文獻（19-20 世紀古籍） | 公共領域 |
| 掃描影像 | 因來源而異，見下方明細 |
| 結構化數據（詞條、OCR 校訂） | CC0 |

**第二段：來源版權明細 — 動態表格**

`onMounted` 時呼叫 `sourcesApi.getAll()`，渲染表格：

| 欄位 | 來源 | 說明 |
|------|------|------|
| 書名 | `name_zh` \|\| `name` | 可點擊，跳轉 `/thak/source/:id` |
| 作者 | `author` | |
| 年份 | `year` | |
| 原書 | 固定 | 「公共領域」 |
| 掃描影像 | `scan_source` | 描述性文字直接渲染，NULL 顯示「—」 |

**第三段：授權聲明**

- **數據**：CC0 — 結構化數據（詞條、OCR 校訂文字）以 CC0 公共領域授權發布
- **代碼**：[MIT](LICENSE)

### 路由註冊：`web/src/router/index.js`

新增路由：

```javascript
{
  path: '/license',
  name: 'License',
  component: () => import('../pages/LicensePage.vue')
}
```

`titles` 新增：`License: '版權聲明 — 潮州話開放資料庫'`

### 導航

AboutPage 底部新增版權聲明連結（與 PrivacyPage 入口方式一致）：

```html
<a href="/#/license">版權聲明</a>
```

### CSS：`web/src/styles/tokens.css`

新增版權表格樣式（複用既有 `.about-section`、`.about-list` 等類，表格用新類 `.license-table`）。需考慮響應式：窄螢幕下表格可橫向滾動。

## 現有內容修正

### README.md

第 116-117 行，授權部分修正：

```markdown
## 授權 / License

- **代碼**：[MIT](LICENSE)
- **結構化數據**（詞條、OCR 校訂）：CC0
- **掃描影像**：因來源而異，詳見[版權聲明](https://openteochew.com/#/license)
- **原書文獻**：公共領域
```

### AboutPage.vue

第 18 行，「開放數據」項修正為：

> 所有整理後的結構化數據（詞條、OCR 校訂）以 CC0 公共領域授權發布。掃描影像版權因來源而異，詳見版權聲明。

### README.md 第 21 行

「開源數據 — 數據 CC0，代碼 MIT」修正為「開源數據 — 結構化數據 CC0，掃描影像版權逐源標注，代碼 MIT」

## 不在範圍內

- `proofread_note` 欄位數據填充與頁面顯示（留待後續確定）
- 掃描影像水印或版權標注覆蓋圖
- 來源詳情頁（SourceViewer）中的版權標註

## 測試

1. **Migration**：執行 `004_add_scan_source.sql` 後，`SELECT scan_source FROM sources` 回傳正確值
2. **CSV 同步**：`./scripts/sync-sources.sh --local` 後，D1 中 scan_source 欄位正確填充
3. **API**：`GET /api/v1/sources` 回傳包含新欄位
4. **頁面渲染**：`/license` 頁面正確顯示三段內容，表格 37 行數據正確，掃描影像欄直接渲染 scan_source 文字
5. **簡繁切換**：頁面所有文字正確轉換
6. **導航**：AboutPage 連結可跳轉到版權頁
7. **回歸**：現有頁面（搜尋、閱讀、來源瀏覽）不受影響
