# 版權聲明頁 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `/license` 版權聲明頁，逐來源列出掃描影像版權情況；修正現有籠統的「數據 CC0」聲明。

**Architecture:** `sources` 表新增 `scan_source`（描述性文字）和 `proofread_note`（暫不用）兩欄 → CSV 回填 → sync 腳本同步到 D1 → 前端新增 LicensePage 動態渲染來源版權明細表格。

**Tech Stack:** Cloudflare D1 (SQLite), Hono, Vue 3 + Vite, CSS tokens

**Spec:** `docs/superpowers/specs/2026-06-23-copyright-page-design.md`

---

## 檔案結構

| 動作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `scripts/004_add_scan_source.sql` | Migration：新增 scan_source、proofread_note 欄位 |
| 修改 | `scripts/sources.csv` | 回填 37 個來源的 scan_source 描述 |
| 修改 | `scripts/sync-sources.sh` | FIELDS 列表新增兩欄 |
| 修改 | `web/src/types/source.ts` | Source interface 新增兩欄 |
| 修改 | `web/src/styles/tokens.css` | 新增 `.license-table` 響應式表格樣式 |
| 新增 | `web/src/pages/LicensePage.vue` | 版權聲明頁 |
| 修改 | `web/src/router/index.js` | 註冊 `/license` 路由 |
| 修改 | `web/src/pages/AboutPage.vue` | 新增版權頁連結 + 修正 CC0 聲明 |
| 修改 | `README.md` | 修正授權段落 |

---

### Task 1: DB Migration

**Files:**
- Create: `scripts/004_add_scan_source.sql`

- [ ] **Step 1: 建立 migration 檔案**

Create `scripts/004_add_scan_source.sql`:

```sql
ALTER TABLE sources ADD COLUMN scan_source TEXT;
ALTER TABLE sources ADD COLUMN proofread_note TEXT;
```

- [ ] **Step 2: 執行 migration 驗證**

Run: `npx wrangler d1 execute openteochew-db --local --file scripts/004_add_scan_source.sql`（在 `backend/` 目錄下）

Expected: 兩個 ALTER TABLE 成功，無錯誤。

驗證：`npx wrangler d1 execute openteochew-db --local --command "PRAGMA table_info(sources)"` 應看到 `scan_source` 和 `proofread_note` 在欄位列表末尾。

- [ ] **Step 3: Commit**

```bash
git add scripts/004_add_scan_source.sql
git commit -m "feat: add scan_source and proofread_note columns to sources table"
```

---

### Task 2: CSV 回填 scan_source

**Files:**
- Modify: `scripts/sources.csv`

- [ ] **Step 1: 新增 CSV 欄位標頭**

Modify `scripts/sources.csv` — 在標頭行末尾加上兩列。

Before:
```
id,slug,name,name_zh,author,year,type,level,status,description,sort_order,original_fields
```

After:
```
id,slug,name,name_zh,author,year,type,level,status,description,sort_order,original_fields,scan_source,proofread_note
```

- [ ] **Step 2: 回填 37 行 scan_source 值**

每行末尾加上 `,<scan_source值>,`（proofread_note 全部留空）。逐行附加的值：

| ID | scan_source（CSV 中的值） |
|----|---------------------------|
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

注意：含半角逗號的值需要用雙引號包裹。以上值中的逗號均為全角逗號（，），不會干擾 CSV 解析，無需加引號。值為 `—` 表示無掃描影像。

- [ ] **Step 3: 驗證 CSV 格式正確**

Run:
```bash
python3 -c "
import csv
with open('scripts/sources.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    print(f'{len(rows)} rows')
    assert all('scan_source' in r for r in rows), 'Missing scan_source'
    assert all('proofread_note' in r for r in rows), 'Missing proofread_note'
    print('Header:', list(rows[0].keys()))
    for r in rows[:3]:
        print(f\"  id={r['id']}, scan_source={r['scan_source'][:30]}...\")
    print('OK')
"
```

Expected: `37 rows` + `OK`，無 assertion error。

- [ ] **Step 4: Commit**

```bash
git add scripts/sources.csv
git commit -m "feat: backfill scan_source for 37 sources in sources.csv"
```

---

### Task 3: 同步腳本更新

**Files:**
- Modify: `scripts/sync-sources.sh`

- [ ] **Step 1: 更新 FIELDS 列表**

Modify `scripts/sync-sources.sh` 第 46 行。

Before:
```python
FIELDS = ["id","name","name_zh","author","year","type","level","status","description","sort_order","original_fields"]
```

After:
```python
FIELDS = ["id","name","name_zh","author","year","type","level","status","description","sort_order","original_fields","scan_source","proofread_note"]
```

- [ ] **Step 2: 同步到本地 D1 並驗證**

Run: `./scripts/sync-sources.sh --local`

Expected: 輸出 `Syncing 37 sources`，無錯誤。

驗證：
```bash
cd backend && npx wrangler d1 execute openteochew-db --local --command "SELECT id, scan_source FROM sources WHERE id IN (1, 10, 9) ORDER BY id"
```

Expected: ID 1 有描述文字，ID 10 有 Dr. Kenny Wang 描述，ID 9 為 `—`。

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-sources.sh
git commit -m "feat: add scan_source and proofread_note to sync script"
```

---

### Task 4: 前端型別定義

**Files:**
- Modify: `web/src/types/source.ts`

- [ ] **Step 1: 新增型別欄位**

Modify `web/src/types/source.ts` — 在 `Source` interface 的 `original_fields` 後面新增：

```typescript
  scan_source: string | null
  proofread_note: string | null
```

完整介面應為：

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
  scan_source: string | null
  proofread_note: string | null
}
```

- [ ] **Step 2: 驗證型別檢查通過**

Run: `cd web && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 無新增錯誤（可能既有錯誤存在，確認沒有與 source.ts 相關的新錯誤即可）。

- [ ] **Step 3: Commit**

```bash
git add web/src/types/source.ts
git commit -m "feat: add scan_source and proofread_note to Source type"
```

---

### Task 5: CSS 樣式

**Files:**
- Modify: `web/src/styles/tokens.css`

- [ ] **Step 1: 新增版權表格樣式**

在 `tokens.css` 的 Responsive 段落之前（約第 448 行 `.lightbox-counter` 區塊之後）新增：

```css
/* ── License table ────────────────────────────── */
.license-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.license-table th { font-family: var(--font-mono); font-size: 11px; font-weight: 400; color: var(--meta); text-transform: uppercase; letter-spacing: 0.04em; text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.license-table td { padding: 10px; border-bottom: 1px solid var(--border-soft); vertical-align: top; line-height: 1.5; }
.license-table tbody tr:hover { background: var(--surface); }
.license-table .col-src { min-width: 160px; }
.license-table .col-scan { min-width: 200px; color: var(--muted); font-size: 13px; }
.license-table .col-pub { color: var(--meta); font-size: 13px; white-space: nowrap; }
.license-table a { color: var(--accent); text-decoration: none; }
.license-table a:hover { text-decoration: underline; }
```

- [ ] **Step 2: 新增響應式規則**

在 Responsive 段落內（第一個 `@media (max-width: 768px)` 區塊末尾，約第 477 行）新增：

```css
  .license-table { font-size: 13px; display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/styles/tokens.css
git commit -m "feat: add license-table styles"
```

---

### Task 6: LicensePage 頁面組件

**Files:**
- Create: `web/src/pages/LicensePage.vue`

- [ ] **Step 1: 建立頁面組件**

Create `web/src/pages/LicensePage.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { sourcesApi } from '../api/sources'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

const sources = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    sources.value = await sourcesApi.getAll()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 920px;">
        <div class="about-hero">
          <h1>{{ t2s('版權聲明') }}</h1>
          <p class="lead">{{ t2s('本站內容的版權分為三個層次，以下逐一說明。') }}</p>
        </div>

        <div class="about-section">
          <h2>{{ t2s('三層版權模型') }}</h2>
          <table class="license-table">
            <thead>
              <tr>
                <th>{{ t2s('層次') }}</th>
                <th>{{ t2s('版權') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="col-src">{{ t2s('原書文獻') }}<br><span class="col-pub">{{ t2s('19-20 世紀古籍') }}</span></td>
                <td>{{ t2s('公共領域') }}</td>
              </tr>
              <tr>
                <td class="col-src">{{ t2s('掃描影像') }}</td>
                <td>{{ t2s('因來源而異，見下方明細') }}</td>
              </tr>
              <tr>
                <td class="col-src">{{ t2s('結構化數據') }}<br><span class="col-pub">{{ t2s('詞條、OCR 校訂') }}</span></td>
                <td>CC0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="about-section">
          <h2>{{ t2s('來源版權明細') }}</h2>
          <p v-if="loading" class="meta-text">{{ t2s('載入中…') }}</p>
          <table v-else class="license-table">
            <thead>
              <tr>
                <th>{{ t2s('書名') }}</th>
                <th>{{ t2s('作者') }}</th>
                <th>{{ t2s('年份') }}</th>
                <th>{{ t2s('原書') }}</th>
                <th>{{ t2s('掃描影像') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="src in sources" :key="src.id">
                <td>
                  <router-link :to="`/thak/source/${src.id}`">
                    {{ t2s(src.name_zh || src.name) }}
                  </router-link>
                </td>
                <td>{{ src.author ? t2s(src.author) : '—' }}</td>
                <td class="col-pub">{{ src.year || '—' }}</td>
                <td class="col-pub">{{ t2s('公共領域') }}</td>
                <td class="col-scan">{{ src.scan_source ? t2s(src.scan_source) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="about-section">
          <h2>{{ t2s('授權聲明') }}</h2>
          <ul class="about-list">
            <li>
              <strong>{{ t2s('結構化數據') }}</strong>
              <p>{{ t2s('詞條、OCR 校訂文字以 CC0 公共領域授權發布，允許自由使用。') }}</p>
            </li>
            <li>
              <strong>{{ t2s('代碼') }}</strong>
              <p><a href="https://github.com/OpenTeochew/openteochew.com/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a></p>
            </li>
          </ul>
        </div>

        <div class="about-section">
          <p class="meta-text">{{ t2s('最後更新：2026-06-23') }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/LicensePage.vue
git commit -m "feat: add LicensePage with copyright overview and source table"
```

---

### Task 7: 路由註冊

**Files:**
- Modify: `web/src/router/index.js`

- [ ] **Step 1: 新增路由**

在 `web/src/router/index.js` 的 routes 陣列中，在 Privacy 路由之後新增：

```javascript
  {
    path: '/license',
    name: 'License',
    component: () => import('../pages/LicensePage.vue')
  }
```

- [ ] **Step 2: 新增頁面標題**

在 `titles` 物件中新增：

```javascript
  License: '版權聲明 — 潮州話開放資料庫'
```

- [ ] **Step 3: 啟動 dev server 驗證頁面渲染**

Run: `./dev.sh`

打開瀏覽器訪問 `http://localhost:8787/#/license`

Expected: 頁面顯示三段內容——三層版權模型表格、37 行來源明細表格、授權聲明。Dr. Kenny Wang 的來源應顯示「影像著作權歸其所有」。

- [ ] **Step 4: Commit**

```bash
git add web/src/router/index.js
git commit -m "feat: register /license route"
```

---

### Task 8: AboutPage 連結 + CC0 聲明修正

**Files:**
- Modify: `web/src/pages/AboutPage.vue`

- [ ] **Step 1: 修正「開放數據」項目**

在 `web/src/pages/AboutPage.vue` 第 18 行。

Before:
```html
<li><strong>{{ t2s('開放數據') }}</strong><p>{{ t2s('所有整理後的數據以 CC0 公共領域授權發布，允許自由使用、研究與二次開發。') }}</p></li>
```

After:
```html
<li><strong>{{ t2s('開放數據') }}</strong><p>{{ t2s('所有整理後的結構化數據（詞條、OCR 校訂）以 CC0 公共領域授權發布。掃描影像版權因來源而異，') }}<router-link to="/license">{{ t2s('詳見版權聲明') }}</router-link>{{ t2s('。') }}</p></li>
```

- [ ] **Step 2: 在致謝段落後新增版權連結**

在 AboutPage 的最後一個 `about-section`（致謝段落 `</div>` 之後、`</div>` container 之前）新增：

```html
        <div class="about-section">
          <p class="meta-text">
            <router-link to="/privacy">{{ t2s('隱私條款') }}</router-link>
            ·
            <router-link to="/license">{{ t2s('版權聲明') }}</router-link>
          </p>
        </div>
```

- [ ] **Step 3: 驗證 AboutPage 渲染**

打開 `http://localhost:8787/#/about`

Expected: 「開放數據」項顯示修正後文字，含版權聲明連結。底部有隱私條款 · 版權聲明連結。點擊連結可跳轉。

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/AboutPage.vue
git commit -m "feat: add license link to AboutPage, fix blanket CC0 statement"
```

---

### Task 9: README 授權段落修正

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 修正 Features 段落的開源數據描述**

在 `README.md` 第 21 行。

Before:
```
- **開源數據** — 數據 CC0，代碼 MIT
```

After:
```
- **開源數據** — 結構化數據 CC0，掃描影像版權逐源標注，代碼 MIT
```

- [ ] **Step 2: 修正授權段落**

在 `README.md` 第 114-117 行。

Before:
```markdown
## 授權 / License

- **代碼**：[MIT](LICENSE)
- **數據**：CC0
```

After:
```markdown
## 授權 / License

- **代碼**：[MIT](LICENSE)
- **結構化數據**（詞條、OCR 校訂）：CC0
- **掃描影像**：因來源而異，詳見[版權聲明](https://openteochew.com/#/license)
- **原書文獻**：公共領域
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: fix blanket CC0 statement in README"
```

---

### Task 10: 最終驗證

- [ ] **Step 1: 前端 build 驗證**

Run: `cd web && npm run build`

Expected: build 成功，無錯誤。

- [ ] **Step 2: 完整手動測試**

Run: `./dev.sh`

逐項驗證：

1. 訪問 `/#/license` — 三段內容正確顯示，表格 37 行
2. 表格中 ID 10 的掃描影像欄顯示「由澳洲雪梨 Dr. Kenny Wang 數位化，影像著作權歸其所有」
3. 表格中 ID 9 的掃描影像欄顯示「—」
4. 點擊書名連結跳轉到 `/thak/source/:id`
5. 切換簡體 — 所有文字正確轉換
6. 訪問 `/#/about` — 「開放數據」文字已修正，含版權聲明連結
7. 底部隱私條款 · 版權聲明連結可跳轉
8. 訪問搜尋頁面 `/` — 確認無回歸
9. 窄螢幕（DevTools 模擬 375px）— 版權表格可橫向滾動

- [ ] **Step 3: 確認所有變更已提交**

Run: `git status`

Expected: working tree clean。
