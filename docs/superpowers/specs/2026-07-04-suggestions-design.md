# 建議收集系統設計 (Suggestions)

> 訪客可在 SourceViewer 劃選 OCR 文字提交修訂建議，或透過獨立反饋頁提交主題建議。Admin 後台審核並匯出 CSV，人工同步回 hokkien-writing dataset。

---

## 1. 背景與範圍

### 1.1 問題

OpenTeochew 目前的 proofread 流程侷限在 `hokkien-writing/dataset/scripts/proofread/server.py`（單機、單人、Python HTTP、改 markdown 檔）。已上線的 openteochew.com 讀者若發現 OCR 錯字、翻譯錯誤或想貢獻資源，缺乏任何在線提交管道。

### 1.2 目標（本 spec 範圍）

建立一個**最小可行**的建議收集系統：

- 訪客在 SourceViewer 頁劃選文字 → 彈出建議提交 UI → 送出
- 訪客可從 TopNav 進入「反饋建議」獨立頁面提交非劃選建議
- Admin 後台審核建議（accept / reject / 備註）
- Admin 匯出 CSV，人工回同步到 hokkien-writing dataset

### 1.3 非目標（本 spec **不**涵蓋）

- 多審核員、trust levels、magic-link 使用者認證
- 詞條 field-level 結構化編輯
- D1 → markdown 反向序列化 / 自動 writeback 到 git
- 建議狀態自動同步、exported_at 標記
- email 通知投稿者
- Rate limit / CAPTCHA（先觀察量體）

上述皆為明確的未來擴展路徑，schema 為之預留欄位（`reviewed_by`、`ip_hash` 等）。

### 1.4 為何走這條路（架構論戰結論摘要）

在 spec 之前並行啟動了三個 agents 論證：

- **Agent A（Git-Native + GitHub PR）**：淘汰。目標人群為半開放志願者/訪客，強制 GitHub 帳號違背最小門檻要求。
- **Agent B（D1-Native）** vs **Agent C（Dual-Track）**：關鍵取捨在「反向序列化器」的可行性——現有 markdown 經 wikisource_to_book + processors + export_csv 多層加工，byte-identical 反寫回 `books/*.md` 極其脆弱。
- **決策**：本次先做**最小切片**——只收集建議（不改資料庫核心表），由人工橋接到 hokkien-writing dataset。等實際運作後再決定是否升級為 D1-Native。

本 spec 定位為「建議收集」，不是「多人編輯」。與 dataset repo 的資料流保持單向（git → D1）不變。

---

## 2. 資料模型

新增一張表 `suggestions`：

```sql
CREATE TABLE suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  source_id INTEGER,
  page_num INTEGER,
  url TEXT,
  selected_text TEXT,
  user_note TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX idx_suggestions_status ON suggestions(status);
CREATE INDEX idx_suggestions_source ON suggestions(source_id);
CREATE INDEX idx_suggestions_created ON suggestions(created_at DESC);
```

**欄位語意：**

- `category`: 三值枚舉 `'text_revision' | 'data_contribution' | 'feedback'`
- `source_id`, `page_num`: 皆可為 NULL。劃選建議由前端從當前 URL（如 `/thak/source/:id?p=N`）自動解析並填入，用戶不可見不可改；獨立反饋頁 URL 無此資訊，兩欄位為 NULL
- `url`: 提交時的完整 URL（含 hash）
- `selected_text`: 劃選內容，長度 <= 500
- `user_note`: 用戶補充說明，長度 <= 500
- `email`: 選填，長度 <= 254
- `status`: `'pending' | 'accepted' | 'rejected' | 'completed'`。四階狀態機：
  - `pending`：訪客提交後的初始狀態，待審核
  - `accepted`：admin 審核通過，等待實際處理（詞條同步 / 資源入庫 / 功能實作等，處理形式視 category 而定）
  - `completed`：實際處理完畢；由 admin 在處理後手動標記
  - `rejected`：admin 審核拒絕
  - 合法轉換：`pending → accepted | rejected`；`accepted → completed | rejected`；`rejected → pending`（誤操作可回退）；`completed` 為終態，如需回退需先改回 `accepted`
- `ip_hash`: SHA-256(IP + WORKER_SALT) 前 16 位
- `user_agent`: 截斷 200 字元
- `reviewed_by`: 目前恆為 `'admin'`，為未來多審核員預留

**Migration 檔案：** `scripts/008_suggestions.sql`

### 類別語意

| 值 | 中文 | 使用場景 |
|---|---|---|
| `text_revision` | 文本修訂 | 劃選 OCR 文字後預設；OCR 錯字、翻譯錯誤等 |
| `data_contribution` | 資料貢獻 | 貢獻新詞條、音訊、掃描檔、翻譯 |
| `feedback` | 反饋建議 | 網站功能、其他 |

劃選建議預設為 `text_revision`，用戶可切換。獨立反饋頁預設為 `feedback`。

---

## 3. API 設計

所有路徑前綴 `/api/v1`。

### 3.1 訪客端

#### `POST /suggestions`

提交建議。無需認證。

Request body（Zod 驗證）：

```json
{
  "category": "text_revision",
  "source_id": 1,
  "page_num": 42,
  "url": "https://openteochew.com/#/thak/source/1?p=42",
  "selected_text": "...",
  "user_note": "...",
  "email": "..."
}
```

驗證規則：

- `category` 必填，為三值枚舉之一
- `url` 必填
- `selected_text` 與 `user_note` 至少一個非空
- `selected_text` 長度 <= 500，超過即拒絕（不截斷）
- `user_note` 長度 <= 500，同上
- `email` 若提供則走 basic email regex
- `source_id`、`page_num` 若提供必須為正整數

Response（成功）：`{ "success": true, "data": { "id": 123 } }`

Response（失敗）：標準錯誤格式，HTTP 400，body 帶 Zod 驗證錯誤詳情。

伺服端額外行為：

- 從 `CF-Connecting-IP` header 取 IP，`SHA-256(IP + env.WORKER_SALT)` 前 16 位存 `ip_hash`
- 從 `User-Agent` header 取前 200 字元存 `user_agent`
- 不做 rate limit（先觀察量體）

### 3.2 Admin

#### `POST /admin/login`

Request body：`{ "token": "..." }`

校驗是否 constant-time 等於 `env.ADMIN_TOKEN`。成功則 setCookie：

```
Set-Cookie: admin_session=<value>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

cookie value 格式：

```
value = base64url(timestamp) + "." + base64url(HMAC-SHA256(env.ADMIN_TOKEN, timestamp))
```

無需額外資料表；middleware 每次請求驗證 HMAC 且 timestamp 未過期（30 天）。

Response：`{ "success": true }`

#### `GET /admin/suggestions`

需 admin cookie。

Query params：

- `status`: `pending | accepted | rejected | completed | all`（默認 `pending`）
- `category`: 三類 | `all`（默認 `all`）
- `source_id`: integer | 未傳（未傳 = 全部）
- `page`: integer（默認 1）
- `limit`: integer（默認 20，上限 100）

Response：`{ success, data: { total, page, items: [...] } }`，每個 item 為 suggestions 表的完整欄位。

#### `PATCH /admin/suggestions/:id`

需 admin cookie。

Request body：`{ "status": "accepted" | "rejected" | "completed" | "pending", "admin_note": "..." }`

同時更新 `reviewed_at = datetime('now')` 和 `reviewed_by = 'admin'`。合法轉換由後端強制（見 §2 狀態機），非法轉換返回 400。

Response：`{ "success": true }`

#### `GET /admin/suggestions/export.csv`

需 admin cookie。

Query params：

- `source_id`: integer（不傳 = 全部來源）
- `include_completed`: boolean（默認 `false`）

行為：匯出 `status = 'accepted'` 的建議，可選按 `source_id` 過濾。若 `include_completed=true` 則同時包含 `status = 'completed'`。

Response headers：

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="suggestions_YYYYMMDD.csv"
```

若指定了 `source_id`，檔名為 `suggestions_source{N}_YYYYMMDD.csv`。

CSV 欄位順序：

```
id, created_at, reviewed_at, status, category, source_id, page_num, url, selected_text, user_note, email, admin_note
```

CSV 用 RFC 4180 標準跳脫（雙引號包裹、內部雙引號用 `""`），第一行為 header，開頭加 UTF-8 BOM 便於 Excel 開啟。

不修改資料庫（不改 `status`），可重複匯出。「完成」的標記需由 admin 於審核頁手動點擊。

---

## 4. 前端設計

### 4.1 路由變更（`web/src/router/index.js`）

| 路徑 | 組件 | 說明 |
|---|---|---|
| `/suggest` | `SuggestPage.vue` | 獨立反饋頁 |
| `/admin` | `AdminLogin.vue` | 輸入 token |
| `/admin/suggestions` | `SuggestionsAdmin.vue` | 審核列表 |

### 4.2 新組件

**`web/src/components/SelectionPopover.vue`**

- 監聽 target 容器內的 `mouseup` / `touchend` / `selectionchange`
- 選中非空文字時，於選區右下方顯示浮動按鈕「回報這段」
- 點擊 → emit `open-suggest`，帶 `selected_text`
- 選區清空時自動隱藏

**`web/src/components/SuggestModal.vue`**

- Modal 對話框，包含表單欄位：
  - 類別 radio（三選一）
  - `selected_text` textarea（若來自劃選：預填、可編輯、可清空）
  - `user_note` textarea（<= 500 字元計數）
  - `email` input（選填）
  - 提交 / 取消 按鈕
- 前端字元計數 + 硬截斷
- 提交後顯示感謝訊息 3 秒後關閉

### 4.3 頁面變更

`web/src/pages/thak/SourceViewer.vue`

- 掛載 `SelectionPopover` 於 OCR 文字容器（不含掃描圖片區）
- 接住 `open-suggest` → 開 `SuggestModal`，預填 `source_id`（來自 `route.params.id`）、`page_num`（來自 `route.query.p`）、`url`（`window.location.href`）、`selected_text`
- 上述四項對用戶不可見，僅在提交時附帶送出

`web/src/pages/SuggestPage.vue`（新）

- 說明區塊 + 與 `SuggestModal` 相同表單（inline，不是 modal）
- 預設類別 `feedback`

`web/src/pages/admin/AdminLogin.vue`（新）

- 輸入 token → POST `/admin/login` → 成功導向 `/admin/suggestions`

`web/src/pages/admin/SuggestionsAdmin.vue`（新）

- 頂部篩選：status（含 `completed`）、category、source_id
- 頂部匯出：source_id 下拉（含「全部」）+ 「包含已完成」checkbox + 匯出按鈕（直接下載）
- 列表：每列展開詳細資訊
  - status = `pending`：顯示 accept / reject 按鈕 + admin_note 輸入
  - status = `accepted`：顯示「完成」按鈕（→ completed）+ 「拒絕」按鈕（→ rejected）
  - status = `completed`：顯示「取消完成」按鈕（→ accepted）+ 「已完成」標籤
  - status = `rejected`：顯示「復原」按鈕（→ pending）
- 分頁

### 4.4 TopNav 變更

`web/src/components/TopNav.vue` 加入「反饋建議」連結到 `/suggest`（實作時決定放 nav 或 footer）。

**Admin 入口不出現在前台任何位置**（TopNav、footer、頁腳、sitemap 皆不含）。管理員直接手動訪問 `/admin` 進入登入頁，登入後自動導向 `/admin/suggestions`。此為 security-through-obscurity 的輔助措施，真正的保護仍靠 `ADMIN_TOKEN`。

### 4.5 樣式

一律用 `web/src/styles/tokens.css` 中的 kami tokens，不引入新 CSS 框架。

---

## 5. 後端設計

### 5.1 檔案結構

```
backend/src/server/
├── routes/
│   ├── suggestions.ts       (新) POST /suggestions
│   └── admin.ts             (新) 全部 admin endpoints
├── schemas/
│   └── suggestion.ts        (新) Zod
├── middleware/
│   └── adminAuth.ts         (新) 驗證 cookie
└── services/
    └── suggestions.ts       (新) D1 CRUD
```

### 5.2 環境變數

`backend/wrangler.jsonc` 需要兩個 secrets（透過 `wrangler secret put` 設定，不寫入 config）：

- `ADMIN_TOKEN` — 後台登入口令
- `WORKER_SALT` — 用於 IP hash

CloudflareBindings 類型定義（`backend/src/server/types/env.ts`）加入這兩個欄位。

### 5.3 CSV 生成

Worker 端手寫一個約 30 行的 CSV serializer（不引入 npm 依賴），遵循 RFC 4180。串流輸出到 Response body。開頭加 UTF-8 BOM (`\ufeff`)。

### 5.4 掛載

`backend/src/index.tsx` 加：

```typescript
app.route('/api/v1/suggestions', suggestionsRoute)
app.route('/api/v1/admin', adminRoute)
```

Admin route 內部套用 `adminAuth` middleware（除了 `/login`）。

---

## 6. 導出後的手動同步流程

Admin 匯出 CSV 後的人工步驟（本 spec 不自動化）：

1. 於 `/admin/suggestions` 篩選 status = `accepted`，選擇 source_id，點匯出下載 CSV（預設排除已完成）
2. 打開 CSV，逐筆閱讀 `selected_text` + `user_note`
3. 依 category 分別處理：
   - `text_revision`：到 `~/Documents/Code/hokkien-writing/dataset/books/{source_slug}.md` 應用修改
   - `data_contribution`：入庫資源到對應位置
   - `feedback`：作為功能規劃輸入
4. 於 dataset repo `git commit -m "Apply suggestions from openteochew.com YYYY-MM-DD"` + push（若涉及 dataset）
5. 回到 openteochew.com：`./scripts/sync-entries.sh --remote --source-id N`（若涉及詞條）
6. **回到 `/admin/suggestions`，將剛處理完的建議點「完成」按鈕**（batch 或逐筆）
7. 網站更新完畢，讀者刷新即可看到修訂

---

## 7. 驗證與測試

### 7.1 手動驗證清單

- [ ] SourceViewer 劃選文字 → popover 出現在正確位置
- [ ] 點 popover 按鈕 → modal 開啟，預填 `selected_text`
- [ ] 500 字元超限 → 前端截斷 + 後端 400
- [ ] 提交成功 → 感謝訊息 → D1 有紀錄
- [ ] 未登入訪問 `/admin/suggestions` → 導向 `/admin`
- [ ] 輸入錯 token → 401 + 錯誤提示
- [ ] 輸入對 token → cookie 設立 → 進入審核頁
- [ ] 審核頁篩選、accept、reject、admin_note 都正確持久化
- [ ] `accepted` 建議顯示「完成」按鈕，點擊後 status → `completed`
- [ ] `completed` 建議顯示「取消完成」按鈕，點擊後 status → `accepted`
- [ ] 非法狀態轉換（如 pending → completed）後端回 400
- [ ] 匯出 CSV：全部 + 單一 source_id 兩種都正確，預設只含 `accepted`（不含 `completed`）
- [ ] 匯出 CSV：勾「包含已完成」時同時含 `accepted` + `completed`
- [ ] CSV 開 Excel/LibreOffice 中文不亂碼（UTF-8 BOM）

### 7.2 單元測試

- `backend/src/server/services/suggestions.test.ts` — CSV 跳脫、Zod 驗證邊界
- `backend/src/server/middleware/adminAuth.test.ts` — HMAC 產出/驗證、過期判斷

### 7.3 邊界情況

- 選中含換行的長段文字：正確保存換行
- 選中含引號、逗號的文字：CSV 正確跳脫
- 極端 URL（含 `#`, `?`, unicode）：保留原樣
- 空 `selected_text` 但有 `user_note`：接受
- 兩者皆空：拒絕
- IP 是 IPv6：hash 照常計算，無特殊處理

---

## 8. 部署與 rollout

### 8.1 步驟

1. 執行 migration（本地）：`npx wrangler d1 execute openteochew-db-dev --local --file scripts/008_suggestions.sql`
2. 執行 migration（線上）：`npx wrangler d1 execute openteochew-db-dev --remote --file scripts/008_suggestions.sql`
3. 設定 secrets：
   - `npx wrangler secret put ADMIN_TOKEN`
   - `npx wrangler secret put WORKER_SALT`
4. 新增 `web/public/robots.txt`（若不存在），內容至少包含 `Disallow: /admin`，防止爬蟲索引 admin 入口
5. 本地驗證：`./dev.sh` → 完成 7.1 清單
6. 部署：`./deploy.sh`
7. 線上煙霧測試：跑一輪完整流程（提交 → 審核 → 匯出）

### 8.2 Rollback

若 admin 頁面或 API 出問題：
- 移除 `/admin/*` 路由掛載，重新部署（訪客端 `/suggestions` 保留收集資料）
- 若 `/suggestions` 收到攻擊：暫時取消該路由掛載或加 return 429

Migration 不可逆但零風險（只加新表）。

---

## 9. 未來擴展路線圖（本 spec 不實作）

按實際運作觀察後再啟動：

1. **spam 防護**：Cloudflare Turnstile 或簡單的 rate limit（KV 計數）
2. **email 通知**：透過 MailChannels 通知投稿者結果（accepted / rejected / completed）
3. **批次「完成」操作**：checkbox 選取多筆一鍵標記 completed
4. **多審核員**：users 表 + magic-link + `reviewed_by` 實際使用
5. **前端「我提過的建議」**：透過 `ip_hash` 或 `email` 查詢
6. **升級為 D1-Native**：新增 D1 → markdown 反向序列化器（本次論戰暫不做）

---

## 10. 相關檔案清單

| 檔案 | 動作 |
|---|---|
| `scripts/008_suggestions.sql` | 新增 |
| `backend/src/server/routes/suggestions.ts` | 新增 |
| `backend/src/server/routes/admin.ts` | 新增 |
| `backend/src/server/schemas/suggestion.ts` | 新增 |
| `backend/src/server/middleware/adminAuth.ts` | 新增 |
| `backend/src/server/services/suggestions.ts` | 新增 |
| `backend/src/server/types/env.ts` | 修改（加兩個 secret 欄位） |
| `backend/src/index.tsx` | 修改（掛新路由） |
| `web/src/router/index.js` | 修改（加三個路由） |
| `web/src/components/SelectionPopover.vue` | 新增 |
| `web/src/components/SuggestModal.vue` | 新增 |
| `web/src/pages/SuggestPage.vue` | 新增 |
| `web/src/pages/admin/AdminLogin.vue` | 新增 |
| `web/src/pages/admin/SuggestionsAdmin.vue` | 新增 |
| `web/src/pages/thak/SourceViewer.vue` | 修改（掛 popover + modal） |
| `web/src/components/TopNav.vue` | 修改（加反饋連結） |
| `web/src/api/suggestions.ts` | 新增（api client） |

---

## 相關文檔

- 架構：`docs/design/architecture.md`
- UI 規範：`docs/design/design-spec.md`
- 原 proofread 工具：`~/Documents/Code/hokkien-writing/dataset/scripts/proofread/`

