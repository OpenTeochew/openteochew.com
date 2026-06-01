# 前後端數據對接設計

> 將 5 個頁面組件從 hardcode 數據切換為真實 API 調用，新增必要的後端端點和數據表。

---

## 決策記錄

| 項目 | 決策 | 理由 |
|------|------|------|
| 跨來源定義 | 前端用 search API 補查 | 無需新端點，search API 已支持按 hanzi 搜尋 |
| ArticleReader | 新增 articles 表存 markdown，前端用 marked 渲染 | 文章即 markdown，最簡方案 |
| 熱門詞彙 / 相關詞 | 隱藏區塊 | 無數據來源，留待後續迭代 |
| SourceViewer pages | 新增 pages API | pages 表已有數據，只需暴露端點 |
| Markdown 渲染器 | marked | 輕量成熟，支持 GFM |

---

## 後端改動

### 1. 新增 articles 表

```sql
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
```

### 2. 新增 API 端點

**GET /api/v1/articles/:id**
- 返回 article 記錄 + 關聯 source 信息
- Response: `{ success: true, data: { id, source_id, title, content, source: { id, name, type } } }`

**GET /api/v1/sources/:id/pages**
- Query params: `page_num` (可選，篩選特定頁)
- Response: `{ success: true, data: Page[] }`

### 3. SQL 遷移腳本

`scripts/003_add_articles.sql` — 建表 + 索引 + 種子數據

---

## 前端改動

### 新增依賴

- `marked` — markdown 渲染

### API Client 更新

- `api/articles.ts` — `articlesApi.getById(id)`
- `api/sources.ts` — `sourcesApi.getPages(sourceId, params?)`

### Types 更新

- `types/article.ts` — `Article { id, source_id, title, content, source }`
- `types/source.ts` — `Page { id, section_id, page_num, image_url, ocr_text }`

### 頁面對接

#### SearchHome (`/chhe`)

- 調 `sourcesApi.getAll()` 替換 hardcode 來源列表
- 接入 `useSearch` composable 處理查詢表單提交
- 隱藏 hotWords 區塊（加 `v-if="false"` 或刪除）

#### SearchResults (`/chhe/results`)

- 從 `useSearchStore` 讀取 `result`（groups, total）
- 用 `useUIStore` 管理來源篩選
- 篩選列表從 groups 動態生成
- 分頁從 total/limit 計算
- 替換全部 hardcode 的 sourceGroups / filters / pages

#### EntryDetail (`/chhe/entry/:id`)

- `entriesApi.getById(id)` 取主詞條 + examples
- 用 entry.hanzi 調 `searchApi.search({ q_hanzi })` 補查其他來源，聚合為 defTabs
- 隱藏 related 區塊
- defTabs 邏輯：先顯示當前來源定義，補查結果到達後展開為多來源 tabs

#### ReadHome (`/thak`)

- `sourcesApi.getAll('scan_dict')` → dicts 列表
- `sourcesApi.getAll('corpus')` + `getAll('text_dict')` → articles 列表
- 替換 hardcode dicts / articles

#### SourceViewer (`/thak/source/:id`)

- `sourcesApi.getById(id)` → metadata（name, author, year, total_pages）
- `sourcesApi.getPages(sourceId, { page_num })` → 頁面數據
- `sourcesApi.getEntries(sourceId, { page_num })` → 頁面詞條
- 替換 hardcode header / ocrEntries / sidebarEntries

#### ArticleReader (`/thak/article/:id`)

- 簡化為 markdown 渲染頁
- `articlesApi.getById(id)` → 取 article（title, content, source）
- 用 `marked` 渲染 content
- 移除三行對齊邏輯和 hardcode textBlocks
- 保留 TOC sidebar（從 markdown headings 提取）

---

## 不做的事

- 不新增 hotWords / related API（隱藏區塊）
- 不修改 DB schema 中已有的表結構
- 不引入 markdown 編輯功能
- 不做 SSR / SEO（SPA hash mode）
