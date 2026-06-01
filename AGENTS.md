# AGENTS.md — OpenTeochew Project Context

## What

潮州話（Teochew）開放語言資源平台。使用者可查詢字典詞條、閱讀語料文章、瀏覽掃描字典頁面。

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + Vite 5 + Vue Router (hash mode) + Pinia |
| CSS | kami 設計系統（CSS 變量，定義於 `web/src/styles/tokens.css`），**不用 Tailwind 工具類** |
| Backend | Hono + TypeScript + Cloudflare Workers |
| DB | Cloudflare D1 (SQLite) |
| Deploy | `build.sh` → `web/dist/` 複製到 `backend/public/` → Wrangler 部署 |

## Structure

```
web/                  # Vue 3 前端
  src/
    pages/            # 7 個頁面組件（見下方路由）
    components/       # TopNav
    styles/tokens.css # 全部 CSS（含響應式），從原型移植
    router/           # hash-based 路由
    api/              # API client（已接入頁面）
    stores/           # Pinia stores（已接入頁面）
    composables/      # useSearch, useIntersection
    types/            # TypeScript 類型定義
backend/              # Hono + Cloudflare Workers
  src/
    index.tsx         # /api/v1 路由 + SPA fallback
    server/
      routes/         # search, entries, sources, articles
      services/       # search, entries
      schemas/        # Zod 驗證
      db/             # D1 查詢輔助
scripts/              # SQL schema + seed data
docs/                 # 設計規範 + 架構文檔
tmp/                  # 原型（已忽略）
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | HomePage | 首頁 hero |
| `/tshue` | SearchHome | 搜尋表單 + 熱門詞彙 + 來源列表 |
| `/tshue/results` | SearchResults | 結果表格（按來源分組） |
| `/tshue/entry/:id` | EntryDetail | 詞條詳情（定義 + 例句） |
| `/thak` | ReadHome | 字典卡片 + 語料列表 |
| `/thak/article/:id` | ArticleReader | 文章閱讀（markdown 渲染 + TOC） |
| `/thak/source/:id` | SourceViewer | 掃描頁 + OCR 詞條列表 |

## DB Schema (6 tables)

- **sources** — 字典/語料/詞表（type: scan_dict | text_dict | corpus | wordlist）
- **sections** — 來源下的章節
- **entries** — 詞條（hanzi, puj, dp, en, mandarin, ja, page_num）
- **examples** — 例句（teochew, puj, translation）
- **pages** — 掃描頁（image_url, ocr_text）
- **articles** — 文章（title, content markdown, source_id）

## API Prefix

`/api/v1` — routes: search, entries, sources, articles

## Key Conventions

- UI 語言：繁體中文，不用 vue-i18n
- CSS：只用 tokens.css 中的類名和變量，不引入 Tailwind 工具類
- `.vue` 頁面組件使用 `<script setup>`（純 JS），不用 `lang="ts"`
- `backend/wrangler.jsonc` 中 D1 database_id 為 `TODO_FILL_IN`
- 原型參考：`tmp/index.html`（已 gitignore）

## Coding Principles

1. **Think Before Coding** — 不假設，不掩蓋困惑，主動揭示權衡。
2. **Simplicity First** — 只寫解決問題的最少代碼，不做投機性設計。
3. **Surgical Changes** — 只改必須改的，只清理自己弄亂的。
4. **Goal-Driven Execution** — 先定義成功標準，循環直到驗證通過。

完成功能後，審視 `docs/` 下設計文檔是否需要同步更新。

## Dev Commands

```bash
# Frontend
cd web && npm run dev      # Vite dev server (proxy /api → :8787)
cd web && npm run build    # Production build

# Backend
cd backend && npm run dev  # Wrangler dev (--remote)

# Full build
./build.sh                 # Build frontend → copy to backend/public
```
