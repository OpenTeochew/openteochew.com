# OpenTeochew 系統總體架構設計

> 本文檔定義 OpenTeochew (潮州話開放資料庫) 平台的技術架構、數據模型、API 設計和部署方案。
> UI 設計規範請參見 [design-spec.md](./design-spec.md)。

---

## 1. 項目概述

**OpenTeochew** 是一個開源潮州話語言資源平台，聚合字典、詞典、語料於統一數字平台。

**兩大功能：**
- **Chhe (查)** — 多欄位、多文字搜尋引擎（PUJ、DP、漢字、English、普通話、日本語），結果按來源分組展示
- **Thak (讀)** — 閱讀瀏覽界面，查看字典掃描頁面（OCR 疊加）、閱讀語料文章（三行對齊：潮州話 / PUJ / 翻譯）

**單一 SPA 架構**，`/chhe` 和 `/thak` 作為頂級路由。

---

## 2. 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Vue Router (hash mode) + Pinia |
| 樣式 | Tailwind CSS + kami 設計 token（自定義顏色映射） |
| 後端 | Hono + TypeScript + Cloudflare Workers |
| 數據庫 | Cloudflare D1 (SQLite) |
| 對象存儲 | Cloudflare R2（字典掃描圖片、音頻，可選） |
| 部署 | Cloudflare Workers + Assets |

---

## 3. 項目結構

```
openteochew.com/
├── web/                          # 前端 (Vue 3 + Vite)
│   ├── src/
│   │   ├── main.js               # 應用入口
│   │   ├── App.vue               # 根組件 (TopNav + RouterView + Footer)
│   │   ├── router/
│   │   │   └── index.js          # Vue Router 配置
│   │   ├── stores/
│   │   │   ├── index.ts          # Pinia 導出
│   │   │   ├── search.ts         # 搜尋狀態、查詢、結果
│   │   │   └── ui.ts             # UI 狀態
│   │   ├── api/
│   │   │   ├── client.ts         # 基礎 HTTP 客戶端
│   │   │   ├── search.ts         # 搜尋 API
│   │   │   ├── entries.ts        # 詞條 API
│   │   │   └── sources.ts        # 來源 API
│   │   ├── composables/
│   │   │   ├── useSearch.ts      # 搜尋邏輯
│   │   │   └── useIntersection.ts # TOC 追蹤
│   │   ├── pages/
│   │   │   ├── HomePage.vue      # 首頁
│   │   │   ├── chhe/
│   │   │   │   ├── SearchHome.vue
│   │   │   │   ├── SearchResults.vue
│   │   │   │   └── EntryDetail.vue
│   │   │   └── thak/
│   │   │       ├── ReadHome.vue
│   │   │       ├── ArticleReader.vue
│   │   │       └── SourceViewer.vue
│   │   ├── components/
│   │   │   ├── TopNav.vue
│   │   │   ├── QueryForm.vue
│   │   │   ├── QueryRow.vue
│   │   │   ├── SourceGroup.vue
│   │   │   ├── ResultsTable.vue
│   │   │   ├── FilterChips.vue
│   │   │   ├── DictCard.vue
│   │   │   ├── ArticleRow.vue
│   │   │   ├── PhraseRow.vue
│   │   │   ├── ChipToggle.vue
│   │   │   └── AudioButton.vue
│   │   ├── styles/
│   │   │   └── tokens.css        # kami 設計 token
│   │   └── types/
│   │       ├── entry.ts
│   │       ├── source.ts
│   │       └── search.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.cjs
│   ├── vite.config.js
│   └── package.json
├── backend/                      # 後端 (Hono + CF Workers)
│   ├── src/
│   │   ├── index.tsx             # Hono 入口 + SPA fallback
│   │   └── server/
│   │       ├── api.ts            # 路由聚合 /api/v1/*
│   │       ├── routes/
│   │       │   ├── search.ts
│   │       │   ├── entries.ts
│   │       │   └── sources.ts
│   │       ├── services/
│   │       │   ├── search.ts     # 搜尋邏輯（多欄位 AND 查詢）
│   │       │   └── entries.ts    # 詞條組裝
│   │       ├── schemas/
│   │       │   └── search.ts     # Zod 驗證
│   │       ├── db/
│   │       │   └── index.ts      # D1 查詢輔助
│   │       └── types/
│   │           └── env.ts        # CloudflareBindings
│   ├── public/                   # 前端構建輸出（gitignore）
│   ├── wrangler.jsonc
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── scripts/                      # 數據遷移 SQL
├── docs/
│   ├── design/
│   │   ├── design-spec.md       # UI 設計規範
│   │   └── architecture.md      # 本文件

│   ├── specs/
│   └── api/
├── build.sh                      # 構建腳本
└── README.md
```

---

## 4. 前端路由

使用 Vue Router 的 `createWebHashHistory` 模式。

| 路由 | 頁面組件 | 描述 |
|------|----------|------|
| `/` | `HomePage.vue` | 首頁（Chhe + Thak 卡片） |
| `/chhe` | `SearchHome.vue` | 搜尋首頁：多欄位查詢表單 |
| `/chhe/results` | `SearchResults.vue` | 搜尋結果：來源分組表格 |
| `/chhe/entry/:id` | `EntryDetail.vue` | 詞條詳情頁 |
| `/thak` | `ReadHome.vue` | 閱讀首頁：來源列表 |
| `/thak/article/:id` | `ArticleReader.vue` | 博客文章閱讀頁（三行對齊 + TOC） |
| `/thak/source/:id` | `SourceViewer.vue` | 來源查看器（掃描圖片 + OCR 疊加 + 詞條列表） |

---

## 5. 統一數據模型

### 5.1 核心概念

所有內容（字典、詞典、語料）統一為 **Source** 模型。每個 Source 都有 sections（章節）和 entries（詞條）。差異僅在渲染方式：

- `scan_dict` — 掃描字典，按頁面查看（DictViewer）
- `text_dict` — 文本詞典，按章節閱讀（CorpusReader）
- `corpus` — 語料文章，三行對齊閱讀（CorpusReader）
- `wordlist` — 詞表，列表查看

### 5.2 D1 Schema

```sql
-- 來源（字典/詞典/語料統一模型）
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_zh TEXT,
  author TEXT,
  publisher TEXT,
  year TEXT,
  type TEXT NOT NULL DEFAULT 'dictionary',
  level TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  cover_url TEXT,
  total_entries INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  original_fields TEXT,
  scan_source TEXT,
  proofread_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 章節
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 詞條（可被搜尋的最小單位）
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  section_id INTEGER REFERENCES sections(id),
  hanzi TEXT,
  puj TEXT,
  dp TEXT,
  en TEXT,
  mandarin TEXT,
  ja TEXT,
  page_num INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 例句
CREATE TABLE examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  teochew TEXT NOT NULL,
  puj TEXT,
  translation TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 頁面（掃描字典用）
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  page_num INTEGER NOT NULL,
  image_url TEXT,
  ocr_text TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX idx_entries_source ON entries(source_id);
CREATE INDEX idx_entries_section ON entries(section_id);
CREATE INDEX idx_entries_hanzi ON entries(hanzi);
CREATE INDEX idx_entries_puj ON entries(puj);
CREATE INDEX idx_entries_dp ON entries(dp);
CREATE INDEX idx_entries_en ON entries(en);
CREATE INDEX idx_entries_mandarin ON entries(mandarin);
CREATE INDEX idx_entries_ja ON entries(ja);
CREATE INDEX idx_entries_page ON entries(source_id, page_num);
CREATE INDEX idx_sections_source ON sections(source_id);
CREATE INDEX idx_pages_section ON pages(section_id);
CREATE INDEX idx_examples_entry ON examples(entry_id);

-- 文章（markdown 內容）
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_articles_source ON articles(source_id);
```

---

## 6. API 設計

所有 API 路徑前綴 `/api/v1`。

### 6.1 搜尋

```
GET /api/v1/search
```

**參數：**
| 參數 | 類型 | 描述 |
|------|------|------|
| `q_hanzi` | string | 漢字搜尋 |
| `q_puj` | string | PUJ 白話字搜尋 |
| `q_dp` | string | DP 潮州拼音搜尋 |
| `q_en` | string | English 搜尋 |
| `q_mandarin` | string | 普通話搜尋 |
| `q_ja` | string | 日本語搜尋 |
| `source_id` | integer | 篩選特定來源 |
| `page` | integer | 分頁（默認 1） |
| `limit` | integer | 每頁數量（默認 20） |

**響應：** 按來源分組的搜尋結果。

```json
{
  "success": true,
  "data": {
    "total": 8,
    "page": 1,
    "groups": [
      {
        "source": { "id": 1, "name": "Ashmore 1883" },
        "count": 3,
        "entries": [
          {
            "id": 42,
            "hanzi": "食",
            "puj": "tsia̍h",
            "dp": "ziah8",
            "en": "to eat; to take food",
            "page_num": 42
          }
        ]
      }
    ]
  }
}
```

### 6.2 詞條

```
GET /api/v1/entries/:id
```

**響應：** 詞條詳情，包含讀音、釋義、例句。

```json
{
  "success": true,
  "data": {
    "id": 42,
    "hanzi": "食",
    "puj": "tsia̍h",
    "dp": "ziah8",
    "en": "to eat; to take food; to consume",
    "mandarin": "吃",
    "ja": "食べる",
    "page_num": 42,
    "source": { "id": 1, "name": "Ashmore 1883", "year": "1883" },
    "examples": [
      {
        "teochew": "食飯",
        "puj": "tsia̍h-pn̄g",
        "translation": "to eat a meal"
      }
    ]
  }
}
```

### 6.3 來源

```
GET /api/v1/sources
```

**參數：**
| 參數 | 類型 | 描述 |
|------|------|------|
| `type` | string | 篩選類型：scan_dict, text_dict, corpus, wordlist |

**響應：** 所有來源列表。

```
GET /api/v1/sources/:id
```

**響應：** 來源詳情 + sections 目錄。

```
GET /api/v1/sources/:id/sections/:sectionId
```

**響應：** section 內容（entries 列表，或 pages 列表）。

```
GET /api/v1/sources/:id/entries
```

**參數：**
| 參數 | 類型 | 描述 |
|------|------|------|
| `section_id` | integer | 篩選章節 |
| `page_num` | integer | 篩選頁碼（scan_dict 用） |
| `page` | integer | 分頁 |
| `limit` | integer | 每頁數量 |

**響應：** 該來源下的詞條列表。

### 6.4 文章

```
GET /api/v1/articles/:id
```

**響應：** 文章詳情，包含 markdown 內容和關聯 source。

```json
{
  "success": true,
  "data": {
    "id": 1,
    "source_id": 1,
    "title": "潮州話食字用法",
    "content": "# 食字用法\n\n...",
    "source": { "id": 1, "name": "Ashmore 1883", "type": "scan_dict" }
  }
}
```

### 6.5 來源頁面

```
GET /api/v1/sources/:id/pages
```

**參數：**
| 參數 | 類型 | 描述 |
|------|------|------|
| `page_num` | integer | 篩選特定頁碼 |

**響應：** 該來源下的 pages 列表。

---

## 7. CSS 策略

使用 **Tailwind CSS** 搭配 **kami 設計 token** 作為自定義顏色映射。

### tailwind.config.js 示例

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        parchment: '#f5f4ed',      // --bg
        ivory: '#faf9f5',          // --surface
        'warm-sand': '#e8e6dc',    // --surface-warm
        'ink-blue': '#1b365d',     // --accent
        'ink-blue-dark': '#142a48', // --accent-active
        'ink-blue-soft': '#e4ecf5', // --accent-soft
        fg: '#141413',
        'fg-2': '#3d3d3a',
        muted: '#504e49',
        meta: '#6b6a64',
        border: '#e8e6dc',
        'border-soft': '#e5e3d8',
      },
      fontFamily: {
        display: ['Charter', 'Georgia', 'Noto Serif SC', 'serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      maxWidth: {
        container: '1080px',
      },
    },
  },
}
```

所有 DESIGN_SPEC 中的 kami 設計規則（accent ≤ 2 次/頁、active 用 warm-sand、無漸變等）通過組件約束執行。

---

## 8. 構建與部署

### 開發

```bash
# 前端開發
cd web && npm run dev

# 後端開發（連接遠程 D1）
cd backend && npm run dev
```

### 構建

```bash
./build.sh
```

構建流程：
1. `cd web && npm run build` → 輸出到 `web/dist/`
2. 清空 `backend/public/`
3. 複製 `web/dist/*` 到 `backend/public/`

### 部署

```bash
cd backend && npm run deploy
```

Wrangler 將 `backend/public/`（前端靜態資源）和 API 統一部署到 Cloudflare Workers。

---

## 9. 搜尋策略

初始版本使用 SQL `LIKE` 查詢。當數據量增長後，可遷移到 SQLite FTS5（全文搜尋）以提升搜尋性能。D1 支持 FTS5 虛擬表。

---

SQL 遷移腳本放在 `scripts/` 目錄，按編號排序：

```
scripts/
├── 001_initial_schema.sql       # 建表
├── 002_seed_sources.sql         # 初始來源數據
└── ...
```

使用 `wrangler d1 execute` 執行遷移：

```bash
cd backend
npx wrangler d1 execute <database-name> --file ../scripts/001_initial_schema.sql
```

---

## 相關文檔

- [UI 設計規範](./design-spec.md)
- [API 文檔](../api/api.md)
