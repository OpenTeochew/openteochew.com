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
scripts/              # SQL schema + seed + sync tools
  full-sync.py     # 全量同步 CSV + OCR pages → 本地 D1
  lib/             # csv-parse, sql-gen, diff 等
docs/                 # 設計規範 + 架構文檔
tmp/                  # 原型（已忽略）
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | HomePage | 首頁 hero |
| `/chhe` | SearchHome | 搜尋表單 + 熱門詞彙 + 來源列表 |
| `/chhe/results` | SearchResults | 結果表格（按來源分組 + 原冊連結） |
| `/chhe/entry/:id` | EntryDetail | 詞條詳情（定義 + 例句 + 原冊連結） |
| `/thak` | ReadHome | 字典卡片 + 語料列表 |
| `/thak/article/:id` | ArticleReader | 文章閱讀（markdown 渲染 + TOC） |
| `/thak/source/:id` | SourceViewer | 掃描頁 + OCR 文字（原文/校訂 toggle） |

## DB Schema (6 tables)

- **sources** — 字典/語料/詞表（type: dictionary | textbook）
- **sections** — 來源下的章節
- **entries** — 詞條（han, puj, en, han_orig, puj_orig, en_orig, page_num）
- **examples** — 例句（teochew, puj, translation）
- **pages** — 掃描頁 OCR（source_id, page_num, image_url, ocr_text）
- **articles** — 文章（title, content markdown, source_id）

## API Prefix

`/api/v1` — routes: search, entries, sources, articles

## Key Conventions

- UI 語言：繁體中文，不用 vue-i18n
- CSS：只用 tokens.css 中的類名和變量，不引入 Tailwind 工具類
- `.vue` 頁面組件使用 `<script setup>`（純 JS），不用 `lang="ts"`
- `backend/wrangler.jsonc` 中 D1 database_id 為 `c2f28963-15db-42a9-9c18-75a79d846086`
- Worker name: `openteochew`，custom domain: `openteochew.com` + `www.openteochew.com`
- 原型參考：`tmp/index.html`（已 gitignore）

## Git Workflow

- 功能開發分支格式：`feat/年月日/功能說明`（例：`feat/20260623/copyright-page`）
- 從 `main` 切出，開發完成後合併回 `main`

## Coding Principles

1. **Think Before Coding** — 不假設，不掩蓋困惑，主動揭示權衡。
2. **Simplicity First** — 只寫解決問題的最少代碼，不做投機性設計。
3. **Surgical Changes** — 只改必須改的，只清理自己弄亂的。
4. **Goal-Driven Execution** — 先定義成功標準，循環直到驗證通過。
5. **Performance Awareness** — 每次改動都評估性能影響，尤其 SQL 查詢和前端渲染。記錄結論，不自欺。

完成功能後，審視 `docs/` 下設計文檔是否需要同步更新。

## External Resources

- **Wiki**：`~/.wiki`

## Data Pipeline

hokkien-writing dataset (`~/Documents/Code/hokkien-writing/dataset`) 提供 CSV + markdown：

1. **`add_page_markers.py`** — 從維基文庫抓取子頁面 HTML，計數 `<dt>` 定位頁碼邊界，在 markdown 插入 `<!-- page:N -->`
2. **Processor** (`processors/001_*.py`) — 解析 markdown，追蹤 page markers，輸出帶 page_num 的 entry
3. **`export_csv.py`** — 匯出 CSV（含 page_num 欄位）
4. **`full-sync.py`**（本 repo）— 讀取 CSV + markdown，全量寫入本地 D1（entries + pages）

```bash
# 重建本地數據
python3 scripts/full-sync.py                    # 默認 source 1
python3 scripts/full-sync.py --entries-only     # 只同步詞條
python3 scripts/full-sync.py --pages-only       # 只同步 OCR 頁
```

## Dev Commands

```bash
# Full build
./build.sh                 # Build frontend → copy to backend/public（保留 scans/）

# Backend
./dev.sh                   # Start backend server（DB 空時自動 init）

# 重建本地 SQLite（dev.sh 內部呼叫，平時不需手動跑）
HW="$HOME/Documents/Code/hokkien-writing/dataset" ./scripts/init_dev_db.sh

# 同步 dataset 到 D1（包裝 scripts/sync-entries.py）
./scripts/sync-entries.sh --local                       # 預設 source 1
./scripts/sync-entries.sh --local --source-id 2         # 指定 source
./scripts/sync-entries.sh --local --entries-only        # 只同步詞條
./scripts/sync-entries.sh --local --pages-only          # 只同步 OCR 頁
./scripts/sync-entries.sh --remote                      # 推到遠端 D1（需 .env.dev）
./scripts/sync-entries.sh --hw /path/to/dataset         # 自訂 dataset 路徑
./scripts/sync-sources.sh --local                       # 同步 sources 元數據 (CSV→D1)
./scripts/sync-sources.sh --remote                      # 同步到遠端 D1

# 部署
./deploy.sh                    # Build + deploy to openteochew.com
```
```
