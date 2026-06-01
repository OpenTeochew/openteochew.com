# 前後端數據對接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 5 個頁面組件從 hardcode 數據切換為真實 API 調用，新增 articles 表和 pages API 端點。

**Architecture:** 後端新增 2 個路由（articles、pages）+ 1 個 SQL 遷移。前端每個頁面組件改為在 `onMounted` 中調 API 取數據，用 `ref` 管理載入/錯誤狀態。搜尋流程通過已有的 `useSearchStore` + `useSearch` composable 貫穿 SearchHome → SearchResults。

**Tech Stack:** Vue 3, Pinia, Hono, D1, Zod, marked

**Design spec:** `docs/superpowers/specs/2026-06-01-data-integration-design.md`

---

## File Map

### 新建

```
scripts/003_add_articles.sql           # articles 表 + 種子數據
backend/src/server/routes/articles.ts  # GET /api/v1/articles/:id
web/src/types/article.ts               # Article 類型
web/src/api/articles.ts                # articlesApi client
```

### 修改

```
backend/src/server/api.ts              # 掛載 articles route
backend/src/server/routes/sources.ts   # 新增 pages 路由
web/src/types/source.ts                # 新增 Page 類型
web/src/api/sources.ts                 # 新增 getPages 方法
web/src/pages/chhe/SearchHome.vue     # 接入 API
web/src/pages/chhe/SearchResults.vue  # 接入 API
web/src/pages/chhe/EntryDetail.vue    # 接入 API
web/src/pages/thak/ReadHome.vue        # 接入 API
web/src/pages/thak/SourceViewer.vue    # 接入 API
web/src/pages/thak/ArticleReader.vue   # 簡化為 markdown 渲染
docs/design/architecture.md            # 同步更新
AGENTS.md                              # 同步更新
```

---

## Task 1: SQL 遷移 — articles 表

**Files:**
- Create: `scripts/003_add_articles.sql`

- [ ] **Step 1: 創建遷移腳本**

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

INSERT INTO articles (source_id, title, content) VALUES
(1, '測試文章：潮州話食字用法', '# 食字用法

潮州話中的「食」字用法比普通話更廣泛，涵蓋吃喝。

## 常見用法

| 詞語 | PUJ | 釋義 |
|------|-----|------|
| 食飯 | tsia̍h-pn̄g | 吃飯 |
| 食茶 | tsia̍h-tê | 喝茶 |
| 食酒 | tsia̍h-tsiú | 喝酒 |

> 資料整理自 Ashmore (1883) 及 Campbell (1904)。');
```

- [ ] **Step 2: Commit**

```bash
git add scripts/003_add_articles.sql
git commit -m "feat: add articles table migration with seed data"
```

---

## Task 2: 後端 — articles 路由

**Files:**
- Create: `backend/src/server/routes/articles.ts`
- Modify: `backend/src/server/api.ts`

- [ ] **Step 1: 創建 articles 路由**

```ts
// backend/src/server/routes/articles.ts
import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/articles/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const article = await c.env.DB.prepare(
    'SELECT * FROM articles WHERE id = ?'
  ).bind(id).first()
  if (!article) return c.json({ success: false, error: 'Article not found' }, 404)

  const source = await c.env.DB.prepare(
    'SELECT id, name, type FROM sources WHERE id = ?'
  ).bind((article as any).source_id).first()

  return c.json({
    success: true,
    data: { ...article, source }
  })
})

export default routes
```

- [ ] **Step 2: 掛載到 api.ts**

在 `backend/src/server/api.ts` 中新增 articles 路由：

```ts
import { Hono } from 'hono'
import type { CloudflareBindings } from './types/env'
import searchRoutes from './routes/search'
import entriesRoutes from './routes/entries'
import sourcesRoutes from './routes/sources'
import articlesRoutes from './routes/articles'

const api = new Hono<{ Bindings: CloudflareBindings }>()

api.route('/', searchRoutes)
api.route('/', entriesRoutes)
api.route('/', sourcesRoutes)
api.route('/', articlesRoutes)

export default api
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/server/
git commit -m "feat: add GET /api/v1/articles/:id endpoint"
```

---

## Task 3: 後端 — pages 路由

**Files:**
- Modify: `backend/src/server/routes/sources.ts`

- [ ] **Step 1: 在 sources.ts 末尾、`export default routes` 之前新增 pages 路由**

在 `backend/src/server/routes/sources.ts` 的 `export default routes` 之前加入：

```ts
routes.get('/sources/:id/pages', async (c) => {
  const sourceId = Number(c.req.param('id'))
  const pageNum = c.req.query('page_num')

  let sql = 'SELECT * FROM pages WHERE section_id IN (SELECT id FROM sections WHERE source_id = ?)'
  const params: any[] = [sourceId]

  if (pageNum) { sql += ' AND page_num = ?'; params.push(Number(pageNum)) }

  sql += ' ORDER BY page_num, sort_order'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/server/routes/sources.ts
git commit -m "feat: add GET /api/v1/sources/:id/pages endpoint"
```

---

## Task 4: 前端 — 新增 types + API client + marked

**Files:**
- Create: `web/src/types/article.ts`
- Modify: `web/src/types/source.ts`
- Create: `web/src/api/articles.ts`
- Modify: `web/src/api/sources.ts`

- [ ] **Step 1: 安裝 marked**

Run: `cd web && npm install marked`

- [ ] **Step 2: 創建 article 類型**

```ts
// web/src/types/article.ts
export interface Article {
  id: number
  source_id: number
  title: string
  content: string
  created_at: string
  updated_at: string
  source: { id: number; name: string; type: string } | null
}
```

- [ ] **Step 3: 在 source.ts 類型末尾新增 Page**

在 `web/src/types/source.ts` 末尾新增：

```ts
export interface Page {
  id: number
  section_id: number
  page_num: number
  image_url: string | null
  ocr_text: string | null
  sort_order: number
}
```

- [ ] **Step 4: 創建 articles API client**

```ts
// web/src/api/articles.ts
import { request } from './client'
import type { Article } from '../types/article'

export const articlesApi = {
  getById(id: number): Promise<Article> {
    return request<Article>(`/api/v1/articles/${id}`)
  }
}
```

- [ ] **Step 5: 在 sources API client 新增 getPages**

在 `web/src/api/sources.ts` 中新增 `getPages` 方法，並 import `Page`：

```ts
import { request } from './client'
import type { Source, SourceDetail, Page } from '../types/source'
import type { Entry } from '../types/entry'

export const sourcesApi = {
  getAll(type?: string): Promise<Source[]> {
    return request<Source[]>('/api/v1/sources', type ? { type } : undefined)
  },
  getById(id: number): Promise<SourceDetail> {
    return request<SourceDetail>(`/api/v1/sources/${id}`)
  },
  getEntries(sourceId: number, params?: Record<string, string | number | undefined>): Promise<Entry[]> {
    return request<Entry[]>(`/api/v1/sources/${sourceId}/entries`, params)
  },
  getPages(sourceId: number, params?: Record<string, string | number | undefined>): Promise<Page[]> {
    return request<Page[]>(`/api/v1/sources/${sourceId}/pages`, params)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/types/ web/src/api/ web/package.json web/package-lock.json
git commit -m "feat: add article/page types, API clients, install marked"
```

---

## Task 5: SearchHome — 接入 API

**Files:**
- Modify: `web/src/pages/chhe/SearchHome.vue`

- [ ] **Step 1: 替換整個 `<script setup>` 區塊**

將 SearchHome.vue 的 `<script setup>` (lines 71-128) 替換為：

```js
import { reactive, ref, onMounted } from 'vue'
import { useSearch } from '../../composables/useSearch'
import { sourcesApi } from '../../api/sources'
import type { Source } from '../../types/source'

const { doSearch } = useSearch()

const placeholders = {
  puj: '例：tsia̍h, tsuí, hó',
  dp: '例：ziah8, zui3, ho3',
  hanzi: '例：食, 潮州, 飯',
  en: '例：eat, water, good',
  zh: '例：吃, 潮州, 你好',
  ja: '例：食べる, お茶, 方言'
}

const queryRows = reactive([
  { field: 'hanzi', value: '' }
])

function addRow() {
  queryRows.push({ field: 'en', value: '' })
}

function removeRow(i: number) {
  if (queryRows.length > 1) queryRows.splice(i, 1)
}

function clearAll() {
  queryRows.forEach(r => { r.value = '' })
}

function handleSubmit() {
  const hasInput = queryRows.some(r => r.value.trim())
  if (hasInput) doSearch(queryRows)
}

const sources = ref<Source[]>([])
const sourcesLoading = ref(true)

onMounted(async () => {
  try {
    sources.value = await sourcesApi.getAll()
  } catch (e) {
    console.error('Failed to load sources:', e)
  } finally {
    sourcesLoading.value = false
  }
})
```

- [ ] **Step 2: 更新 template 中來源卡片**

將 template 中 hotWords 區塊（lines 35-44）替換為隱藏：

```html
    <!-- 熱門查詢待接入 -->
```

將 template 中來源卡片（lines 46-58）替換為：

```html
    <section class="section">
      <div class="container">
        <h2>收錄來源</h2>
        <div v-if="sourcesLoading" class="source-grid"><p>載入中…</p></div>
        <div v-else class="source-grid">
          <div v-for="s in sources" :key="s.id" class="source-card">
            <span class="source-badge">{{ s.level || '—' }}</span>
            <h3>{{ s.name }}</h3>
            <p class="meta-text">{{ [s.author, s.year].filter(Boolean).join(' · ') }}</p>
            <p>{{ s.description }}</p>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/chhe/SearchHome.vue
git commit -m "feat: wire SearchHome to sources API and useSearch composable"
```

---

## Task 6: SearchResults — 接入 API

**Files:**
- Modify: `web/src/pages/chhe/SearchResults.vue`

- [ ] **Step 1: 替換整個 `<script setup>` 區塊**

將 SearchResults.vue 的 `<script setup>` (lines 67-133) 替換為：

```js
import { reactive, ref, computed, onMounted } from 'vue'
import { useSearchStore } from '../../stores/search'
import { useSearch } from '../../composables/useSearch'
import type { SearchGroup } from '../../types/search'

const store = useSearchStore()
const { doSearch } = useSearch()

const placeholders = {
  puj: '例：tsia̍h, tsuí, hó',
  dp: '例：ziah8, zui3, ho3',
  hanzi: '例：食, 潮州, 飯',
  en: '例：eat, water, good',
  zh: '例：吃, 潮州, 你好',
  ja: '例：食べる, お茶, 方言'
}

const queryRows = reactive([
  { field: 'hanzi', value: '' }
])

const activeFilter = ref(0)

const groups = computed<SearchGroup[]>(() => store.result?.groups || [])
const total = computed(() => store.result?.total || 0)
const currentPage = computed(() => store.result?.page || 1)

const filters = computed(() => {
  const names = groups.value.map(g => g.source.name)
  return ['全部來源', ...names]
})

const filteredGroups = computed(() => {
  if (activeFilter.value === 0) return groups.value
  return groups.value.filter((_, i) => i === activeFilter.value - 1)
})

function addRow() {
  queryRows.push({ field: 'en', value: '' })
}

function removeRow(i: number) {
  if (queryRows.length > 1) queryRows.splice(i, 1)
}

function handleSearch() {
  const hasInput = queryRows.some(r => r.value.trim())
  if (hasInput) doSearch(queryRows)
}

onMounted(() => {
  if (store.result && store.params) {
    const params = store.params
    for (const [k, v] of Object.entries(params)) {
      if (v && k.startsWith('q_')) {
        const field = k.slice(2)
        if (queryRows.length === 1 && queryRows[0].field === 'hanzi' && !queryRows[0].value) {
          queryRows[0] = { field, value: String(v) }
        } else {
          queryRows.push({ field, value: String(v) })
        }
      }
    }
  }
})
```

- [ ] **Step 2: 更新 template**

將整個 `<template>` 替換為：

```html
<template>
  <div>
    <div class="search-bar">
      <div class="container">
        <div class="query-rows">
          <div v-for="(row, i) in queryRows" :key="i" class="query-row">
            <select v-model="row.field" class="query-select">
              <option value="puj">PUJ 白話字</option>
              <option value="dp">DP 潮州拼音</option>
              <option value="hanzi">漢字</option>
              <option value="en">English</option>
              <option value="zh">普通話</option>
              <option value="ja">日本語</option>
            </select>
            <input v-model="row.value" type="text" class="query-input" :placeholder="placeholders[row.field]">
            <button type="button" class="query-remove" :class="{ hidden: queryRows.length <= 1 }" title="移除此條件" @click="removeRow(i)">&times;</button>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap;">
          <button type="button" class="query-add" @click="addRow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新增條件
          </button>
          <button class="search-bar-btn" @click="handleSearch">查</button>
        </div>
      </div>
    </div>
    <main class="section">
      <div class="container">
        <div v-if="store.loading" style="text-align:center;padding:60px 0;color:var(--muted)">搜尋中…</div>
        <div v-else-if="store.error" style="text-align:center;padding:60px 0;color:var(--muted)">{{ store.error }}</div>
        <template v-else-if="store.result">
          <div class="results-header">
            <p class="results-count">找到 <strong>{{ total }}</strong> 筆結果（{{ groups.length }} 個來源）</p>
            <div class="filter-chips">
              <button v-for="(f, i) in filters" :key="f" class="filter-chip" :class="{ active: activeFilter === i }" @click="activeFilter = i">{{ f }}</button>
            </div>
          </div>

          <div v-for="group in filteredGroups" :key="group.source.name" class="source-group">
            <div class="source-group-head">
              <span class="source-group-title">{{ group.source.name }}</span>
              <span class="source-group-count">{{ group.count }} 筆</span>
            </div>
            <table class="results-table">
              <thead><tr><th>漢字</th><th>PUJ</th><th>DP</th><th>釋義</th><th>頁碼</th><th></th></tr></thead>
              <tbody>
                <tr v-for="entry in group.entries" :key="entry.id" @click="$router.push({ name: 'EntryDetail', params: { id: entry.id } })">
                  <td class="rt-char">{{ entry.hanzi }}</td>
                  <td class="rt-puj">{{ entry.puj }}</td>
                  <td class="rt-dp">{{ entry.dp }}</td>
                  <td class="rt-def">{{ entry.en }}</td>
                  <td class="rt-page">{{ entry.page_num ? `p. ${entry.page_num}` : '' }}</td>
                  <td><button class="rt-audio" @click.stop><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div v-else style="text-align:center;padding:60px 0;color:var(--muted)">請輸入搜尋條件</div>
      </div>
    </main>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/chhe/SearchResults.vue
git commit -m "feat: wire SearchResults to search store, replace all hardcoded data"
```

---

## Task 7: EntryDetail — 接入 API

**Files:**
- Modify: `web/src/pages/chhe/EntryDetail.vue`

- [ ] **Step 1: 替換整個 `<script setup>` 區塊**

```js
import { ref, onMounted, computed } from 'vue'
import { entriesApi } from '../../api/entries'
import { searchApi } from '../../api/search'
import type { EntryDetail as EntryDetailType } from '../../types/entry'
import type { SearchGroup } from '../../types/search'

const props = defineProps({ id: { type: [String, Number], required: true } })

const audioPlaying = ref(false)
const loading = ref(true)
const entry = ref<EntryDetailType | null>(null)
const crossSourceGroups = ref<SearchGroup[]>([])

function toggleAudio() {
  audioPlaying.value = !audioPlaying.value
}

const activeTab = ref('all')

const defTabs = computed(() => {
  if (!entry.value) return []

  const current = {
    key: 'all',
    label: '全部來源',
    definitions: [] as { source: string; text: string }[]
  }

  const tabs = [{ ...current }]

  const currentDef = {
    source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
    text: `<strong>${entry.value.hanzi || ''} ${entry.value.puj || ''}</strong> — ${entry.value.en || ''}`
  }
  tabs[0].definitions.push(currentDef)

  const sourceTabs: Record<string, { key: string; label: string; definitions: { source: string; text: string }[] }> = {}
  sourceTabs[entry.value.source.name] = {
    key: `source-${entry.value.source.id}`,
    label: entry.value.source.name,
    definitions: [currentDef]
  }

  for (const group of crossSourceGroups.value) {
    if (group.source.id === entry.value.source.id) continue
    for (const e of group.entries) {
      const def = {
        source: `${group.source.name}${e.page_num ? ' · p. ' + e.page_num : ''}`,
        text: `<strong>${e.hanzi || ''} ${e.puj || ''}</strong> — ${e.en || ''}`
      }
      tabs[0].definitions.push(def)

      if (!sourceTabs[group.source.name]) {
        sourceTabs[group.source.name] = {
          key: `source-${group.source.id}`,
          label: group.source.name,
          definitions: []
        }
      }
      sourceTabs[group.source.name].definitions.push(def)
    }
  }

  return [...tabs, ...Object.values(sourceTabs)]
})

const examples = computed(() => entry.value?.examples || [])

onMounted(async () => {
  try {
    entry.value = await entriesApi.getById(Number(props.id))

    if (entry.value?.hanzi) {
      try {
        const result = await searchApi.search({ q_hanzi: entry.value.hanzi, limit: 50 })
        crossSourceGroups.value = result.groups
      } catch {}
    }
  } catch (e) {
    console.error('Failed to load entry:', e)
  } finally {
    loading.value = false
  }
})
```

- [ ] **Step 2: 更新 template**

將整個 `<template>` 替換為：

```html
<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!entry" style="text-align:center;padding:80px 0;color:var(--muted)">詞條未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'SearchHome' }">Chhe</router-link> › <router-link :to="{ name: 'SearchResults' }">搜索「{{ entry.hanzi }}」</router-link> › 詞條詳情
    </div>
    <main>
      <section class="entry-header container">
        <div class="entry-header-inner">
          <div class="entry-char">{{ entry.hanzi }}</div>
          <div class="entry-info">
            <div class="entry-puj">{{ entry.puj }}</div>
            <div class="entry-readings">
              <div class="reading-row"><span class="reading-label">PUJ</span><span class="reading-value">{{ entry.puj }}</span></div>
              <div class="reading-row"><span class="reading-label">DP</span><span class="reading-value">{{ entry.dp }}</span></div>
            </div>
            <div class="entry-actions">
              <button class="entry-audio-btn" @click="toggleAudio">
                <svg viewBox="0 0 24 24" fill="currentColor" v-html="audioPlaying ? '<rect x=\'6\' y=\'4\' width=\'4\' height=\'16\'/><rect x=\'14\' y=\'4\' width=\'4\' height=\'16\'/>' : '<path d=\'M8 5v14l11-7z\'/>'"></svg>
                播放讀音
              </button>
              <button class="share-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                分享
              </button>
            </div>
          </div>
        </div>
      </section>
      <section class="section defs-section container">
        <h2>釋義</h2>
        <div class="def-tabs" role="tablist">
          <button v-for="tab in defTabs" :key="tab.key" class="def-tab" :class="{ active: activeTab === tab.key }" role="tab" @click="activeTab = tab.key">{{ tab.label }}</button>
        </div>
        <div v-for="tab in defTabs" :key="tab.key" class="def-panel" :class="{ active: activeTab === tab.key }">
          <div v-for="d in tab.definitions" :key="d.source" class="def-block">
            <p class="def-source">{{ d.source }}</p>
            <p class="def-text" v-html="d.text"></p>
          </div>
        </div>
      </section>
      <section v-if="examples.length" class="section examples-section container">
        <h2>例句</h2>
        <div class="example-list">
          <div v-for="ex in examples" :key="ex.teochew" class="example-item">
            <p class="example-teochew">{{ ex.teochew }}</p>
            <p class="example-puj">{{ ex.puj }}</p>
            <p class="example-translation">{{ ex.translation }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/chhe/EntryDetail.vue
git commit -m "feat: wire EntryDetail to entries API + cross-source search"
```

---

## Task 8: ReadHome — 接入 API

**Files:**
- Modify: `web/src/pages/thak/ReadHome.vue`

- [ ] **Step 1: 替換 `<script setup>`**

```js
import { ref, onMounted } from 'vue'
import { sourcesApi } from '../../api/sources'
import type { Source } from '../../types/source'

const activeCat = ref(0)
const catTabs = ['全部', '字典原書', '語料文本', '教材']

const dicts = ref<Source[]>([])
const articles = ref<Source[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const all = await sourcesApi.getAll()
    dicts.value = all.filter(s => s.type === 'scan_dict')
    articles.value = all.filter(s => s.type === 'corpus' || s.type === 'text_dict' || s.type === 'wordlist')
  } catch (e) {
    console.error('Failed to load sources:', e)
  } finally {
    loading.value = false
  }
})

function typeLabel(type: string) {
  const map: Record<string, string> = { corpus: '語料', text_dict: '文本', wordlist: '教材' }
  return map[type] || type
}
```

- [ ] **Step 2: 更新 template**

將 `<template>` 替換為：

```html
<template>
  <main>
    <section class="section thak-hero">
      <div class="container" style="max-width: 680px;">
        <h1>讀潮州話</h1>
        <p class="lead">瀏覽原始字典頁面，閱讀語料與潮州話文本。所有資料標明出處，開放使用。</p>
        <div class="cat-tabs">
          <button v-for="(t, i) in catTabs" :key="t" class="cat-tab" :class="{ active: activeCat === i }" @click="activeCat = i">{{ t }}</button>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>字典原書</h2>
        <div v-if="loading" style="color:var(--muted)">載入中…</div>
        <div v-else class="dict-grid">
          <router-link v-for="d in dicts" :key="d.id" :to="{ name: 'SourceViewer', params: { id: d.id } }" class="dict-card">
            <div class="dict-cover">{{ (d.name_zh || d.name).slice(0, 10) }}<br>{{ d.year }}</div>
            <div class="dict-info">
              <h3>{{ d.name }}</h3>
              <p>{{ d.description }}</p>
              <div class="dict-meta">
                <span class="dict-tag">{{ d.level || '—' }}</span>
                <span class="meta-text">{{ d.total_pages ? d.total_pages + ' 頁' : '—' }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
          <h2 style="margin-bottom:0">語料與文本</h2>
          <span class="meta-text">持續更新</span>
        </div>
        <div v-if="loading" style="color:var(--muted)">載入中…</div>
        <div v-else class="article-list">
          <router-link v-for="a in articles" :key="a.id" :to="{ name: 'ArticleReader', params: { id: a.id } }" class="article-row">
            <span class="article-date">{{ typeLabel(a.type) }}</span>
            <div>
              <span class="article-title">{{ a.name }}</span>
              <p class="article-desc">{{ a.description }}</p>
            </div>
            <span class="article-type">{{ typeLabel(a.type) }}</span>
          </router-link>
        </div>
      </div>
    </section>
  </main>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/thak/ReadHome.vue
git commit -m "feat: wire ReadHome to sources API, split dicts/articles by type"
```

---

## Task 9: SourceViewer — 接入 API

**Files:**
- Modify: `web/src/pages/thak/SourceViewer.vue`

- [ ] **Step 1: 替換 `<script setup>`**

```js
import { ref, computed, watch, onMounted } from 'vue'
import { sourcesApi } from '../../api/sources'
import type { SourceDetail, Page } from '../../types/source'
import type { Entry } from '../../types/entry'

const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const source = ref<SourceDetail | null>(null)
const viewMode = ref('scan')
const pageNum = ref(1)
const sidebarQuery = ref('')
const entries = ref<Entry[]>([])
const pages = ref<Page[]>([])

async function loadData() {
  loading.value = true
  try {
    source.value = await sourcesApi.getById(Number(props.id))
    const [entriesResult, pagesResult] = await Promise.all([
      sourcesApi.getEntries(Number(props.id), { page_num: pageNum.value }),
      sourcesApi.getPages(Number(props.id), { page_num: pageNum.value })
    ])
    entries.value = entriesResult
    pages.value = pagesResult
  } catch (e) {
    console.error('Failed to load source:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(pageNum, async () => {
  try {
    const [entriesResult, pagesResult] = await Promise.all([
      sourcesApi.getEntries(Number(props.id), { page_num: pageNum.value }),
      sourcesApi.getPages(Number(props.id), { page_num: pageNum.value })
    ])
    entries.value = entriesResult
    pages.value = pagesResult
  } catch (e) {
    console.error('Failed to load page data:', e)
  }
})

const filteredEntries = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(e =>
    (e.hanzi || '').toLowerCase().includes(q) ||
    (e.puj || '').toLowerCase().includes(q) ||
    (e.en || '').toLowerCase().includes(q)
  )
})

const currentPage = computed(() => pages.value[0] || null)
```

- [ ] **Step 2: 更新 template**

將 `<template>` 替換為：

```html
<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!source" style="text-align:center;padding:80px 0;color:var(--muted)">來源未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › <router-link :to="{ name: 'ReadHome' }">字典原書</router-link> › <span style="color:var(--fg)">{{ source.name }}</span>
    </div>
    <div class="container dict-header">
      <div class="dict-header-inner">
        <div>
          <h1>{{ source.name }}</h1>
          <p class="meta-text">{{ [source.author, source.year].filter(Boolean).join(' · ') }}</p>
        </div>
        <div class="view-toggle">
          <button class="view-btn" :class="{ active: viewMode === 'scan' }" @click="viewMode = 'scan'">原書掃描</button>
          <button class="view-btn" :class="{ active: viewMode === 'ocr' }" @click="viewMode = 'ocr'">OCR 文字</button>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="viewer-layout">
        <div class="page-viewer">
          <div class="page-image">
            <svg class="page-image-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4M7 11h10M7 15h6"/></svg>
            <p class="page-image-text">原書掃描頁面<br><span style="font-size:12px">第 {{ pageNum }} 頁 · {{ source.name }}</span></p>
          </div>
          <div class="ocr-overlay" :class="{ visible: viewMode === 'ocr' }">
            <div v-if="currentPage?.ocr_text" v-html="currentPage.ocr_text"></div>
            <div v-else>
              <div v-for="e in entries" :key="e.id" class="ocr-entry">
                <span class="ocr-char">{{ e.hanzi }}</span><span class="ocr-puj">{{ e.puj }}</span>
                <p class="ocr-def">{{ e.en }}</p>
              </div>
            </div>
          </div>
          <div class="page-nav">
            <button class="page-nav-btn" :disabled="pageNum <= 1" @click="pageNum--">← 上一頁</button>
            <span class="page-num">第 {{ pageNum }} 頁 / 共 {{ source.total_pages || '—' }} 頁</span>
            <button class="page-nav-btn" @click="pageNum++">下一頁 →</button>
          </div>
        </div>
        <aside class="entry-sidebar">
          <p class="sidebar-title">本頁詞條</p>
          <div class="sidebar-search"><input v-model="sidebarQuery" type="text" class="sidebar-input" placeholder="在詞條中搜索…"></div>
          <ul class="entry-list">
            <li v-for="e in filteredEntries" :key="e.id" class="entry-item">
              <router-link :to="{ name: 'EntryDetail', params: { id: e.id } }" class="entry-link">
                <span class="entry-link-char">{{ e.hanzi }}</span>
                <span class="entry-link-puj">{{ e.puj }}</span>
                <span class="entry-link-def">{{ e.en }}</span>
              </router-link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/thak/SourceViewer.vue
git commit -m "feat: wire SourceViewer to sources/pages/entries APIs"
```

---

## Task 10: ArticleReader — 簡化為 markdown 渲染

**Files:**
- Modify: `web/src/pages/thak/ArticleReader.vue`

- [ ] **Step 1: 替換整個文件內容**

```vue
<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!article" style="text-align:center;padding:80px 0;color:var(--muted)">文章未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › 語料與文本 › <span style="color:var(--fg)">{{ article.title }}</span>
    </div>
    <div class="container">
      <div class="read-layout">
        <article class="read-main">
          <div class="read-meta">
            <span class="read-tag" v-if="article.source">{{ article.source.type }}</span>
          </div>
          <h1 class="read-title">{{ article.title }}</h1>
          <div class="markdown-body" v-html="renderedContent"></div>
        </article>
        <aside v-if="tocItems.length" class="toc-sidebar">
          <p class="toc-title">目錄</p>
          <ul class="toc-list">
            <li v-for="item in tocItems" :key="item.id">
              <a :href="'#' + item.id" class="toc-link" :class="{ active: activeSection === item.id }" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import { articlesApi } from '../../api/articles'
import type { Article } from '../../types/article'

const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const article = ref<Article | null>(null)
const activeSection = ref('')

const renderedContent = computed(() => {
  if (!article.value) return ''
  return marked.parse(article.value.content)
})

const tocItems = computed(() => {
  if (!article.value) return []
  const headings: { id: string; text: string }[] = []
  const matches = article.value.content.matchAll(/^#{1,3}\s+(.+)$/gm)
  for (const m of matches) {
    const text = m[1].trim()
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-')
    headings.push({ id, text })
  }
  return headings
})

let observer = null

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  try {
    article.value = await articlesApi.getById(Number(props.id))

    setTimeout(() => {
      const blocks = tocItems.value.map(item => document.getElementById(item.id)).filter(Boolean)
      if (!blocks.length) return
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeSection.value = entry.target.id
          }
        })
      }, { rootMargin: '-20% 0px -60% 0px' })
      blocks.forEach((el) => observer.observe(el))
    }, 100)
  } catch (e) {
    console.error('Failed to load article:', e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>
```

- [ ] **Step 2: 在 tokens.css 中新增 markdown 樣式**

在 `web/src/styles/tokens.css` 的 `/* ── Responsive */` 區塊之前加入：

```css
/* ── Markdown body ────────────────────────────── */
.markdown-body { font-size: 16px; line-height: 1.7; color: var(--fg-2); }
.markdown-body h1 { font-size: 28px; margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-soft); }
.markdown-body h2 { font-size: 22px; margin: 32px 0 12px; }
.markdown-body h3 { font-size: 18px; margin: 24px 0 8px; }
.markdown-body p { margin-bottom: 16px; }
.markdown-body ul, .markdown-body ol { margin-bottom: 16px; padding-left: 24px; }
.markdown-body li { margin-bottom: 4px; }
.markdown-body blockquote { border-left: 3px solid var(--border); padding-left: 16px; color: var(--muted); margin: 16px 0; }
.markdown-body table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
.markdown-body th, .markdown-body td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; }
.markdown-body th { background: var(--surface); font-family: var(--font-mono); font-size: 12px; font-weight: 500; color: var(--meta); }
.markdown-body code { font-family: var(--font-mono); font-size: 14px; background: var(--surface-warm); padding: 2px 6px; border-radius: 4px; }
.markdown-body pre { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; overflow-x: auto; margin: 16px 0; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body strong { font-weight: 500; color: var(--fg); }
.markdown-body a { color: var(--accent); }
.markdown-body a:hover { text-decoration: underline; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/thak/ArticleReader.vue web/src/styles/tokens.css
git commit -m "feat: simplify ArticleReader to markdown rendering with TOC"
```

---

## Task 11: 修復 useSearch composable 的 field 映射

**Files:**
- Modify: `web/src/composables/useSearch.ts`

- [ ] **Step 1: 修正 field 映射問題**

SearchHome/SearchResults 中的 select option 值 `zh` 需要映射到 SearchParams 的 `q_mandarin`。更新 `useSearch.ts`：

```ts
import { useRouter } from 'vue-router'
import { useSearchStore } from '../stores/search'
import type { SearchParams } from '../types/search'

const FIELD_MAP: Record<string, string> = {
  puj: 'puj',
  dp: 'dp',
  hanzi: 'hanzi',
  en: 'en',
  zh: 'mandarin',
  ja: 'ja'
}

export function useSearch() {
  const router = useRouter()
  const store = useSearchStore()

  function buildParams(rows: { field: string; value: string }[]): SearchParams {
    const params: SearchParams = {}
    for (const row of rows) {
      if (!row.value.trim()) continue
      const mappedField = FIELD_MAP[row.field] || row.field
      const key = `q_${mappedField}` as keyof SearchParams
      ;(params as any)[key] = row.value.trim()
    }
    return params
  }

  async function doSearch(rows: { field: string; value: string }[]) {
    const params = buildParams(rows)
    await store.search(params)
    router.push({ name: 'SearchResults' })
  }

  return { store, buildParams, doSearch }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/composables/useSearch.ts
git commit -m "fix: map 'zh' field to 'mandarin' in useSearch composable"
```

---

## Task 12: 前端構建驗證 + 文檔更新

**Files:**
- Modify: `docs/design/architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 驗證前端構建**

Run: `cd web && npm run build`
Expected: 構建成功，無錯誤

- [ ] **Step 2: 更新 AGENTS.md**

在 AGENTS.md 中更新以下內容：
- DB Schema 部分新增 `articles` 表
- Structure 部分：`api/` 和 `stores/` 描述改為「已接入」
- Key Conventions 移除「頁面組件目前使用 hardcode 數據」

- [ ] **Step 3: 更新 architecture.md**

在 `docs/design/architecture.md` 中：
- DB Schema 新增 articles 表定義
- API 設計新增 articles 和 pages 端點文檔
- 項目結構中新增新文件

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/design/architecture.md
git commit -m "docs: sync AGENTS.md and architecture.md with data integration"
```
