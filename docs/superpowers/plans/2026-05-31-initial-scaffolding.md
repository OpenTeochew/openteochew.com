# OpenTeochew 基礎架構搭建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 openteochew.com 項目的完整基礎架構（前端 Vue 3 + Vite + Tailwind、後端 Hono + Cloudflare Workers + D1），包括路由、API 骨架、數據庫 schema、構建流程。

**Architecture:** 前後端分離的 monorepo。`web/` 為 Vue 3 SPA，`backend/` 為 Hono API 服務，`build.sh` 將前端產物複製到 `backend/public/`，通過 Wrangler 統一部署到 Cloudflare Workers。使用 hash-based routing、kami 設計 token 映射到 Tailwind 自定義顏色。

**Tech Stack:** Vue 3, Vite, Vue Router (hash mode), Pinia, Tailwind CSS, Hono, TypeScript, Cloudflare Workers, D1, Zod

**Architecture doc:** `docs/design/architecture.md`
**Design spec:** `docs/design/design-spec.md`

---

## File Map

### 前端 (web/)
```
web/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.cjs
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── router/index.js
│   ├── stores/index.ts
│   ├── stores/search.ts
│   ├── stores/ui.ts
│   ├── api/client.ts
│   ├── api/search.ts
│   ├── api/entries.ts
│   ├── api/sources.ts
│   ├── composables/useSearch.ts
│   ├── composables/useIntersection.ts
│   ├── styles/tokens.css
│   ├── types/entry.ts
│   ├── types/source.ts
│   ├── types/search.ts
│   ├── pages/HomePage.vue
│   ├── pages/tshue/SearchHome.vue
│   ├── pages/tshue/SearchResults.vue
│   ├── pages/tshue/EntryDetail.vue
│   ├── pages/thak/ReadHome.vue
│   ├── pages/thak/ArticleReader.vue
│   ├── pages/thak/SourceViewer.vue
│   ├── components/TopNav.vue
│   ├── components/QueryForm.vue
│   ├── components/QueryRow.vue
│   ├── components/SourceGroup.vue
│   ├── components/ResultsTable.vue
│   ├── components/FilterChips.vue
│   ├── components/DictCard.vue
│   ├── components/ArticleRow.vue
│   ├── components/PhraseRow.vue
│   ├── components/ChipToggle.vue
│   └── components/AudioButton.vue
```

### 後端 (backend/)
```
backend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── src/
│   ├── index.tsx
│   └── server/
│       ├── api.ts
│       ├── routes/search.ts
│       ├── routes/entries.ts
│       ├── routes/sources.ts
│       ├── services/search.ts
│       ├── services/entries.ts
│       ├── schemas/search.ts
│       ├── db/index.ts
│       └── types/env.ts
```

### 共享
```
scripts/001_initial_schema.sql
build.sh
web/.gitignore
backend/.gitignore
```

---

## Task 1: 前端項目初始化

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/tailwind.config.js`
- Create: `web/postcss.config.cjs`
- Create: `web/index.html`
- Create: `web/.gitignore`
- Create: `web/src/main.js`
- Create: `web/src/styles/tokens.css`

- [ ] **Step 1: 創建 web 目錄和 package.json**

```json
{
  "name": "openteochew-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "pinia": "^3.0.4",
    "vue": "^3.3.4",
    "vue-router": "^4.2.2"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.0.0",
    "autoprefixer": "^10.4.22",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.18",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: 創建 vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
```

- [ ] **Step 3: 創建 tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        parchment: '#f5f4ed',
        ivory: '#faf9f5',
        'warm-sand': '#e8e6dc',
        'ink-blue': '#1b365d',
        'ink-blue-dark': '#142a48',
        'ink-blue-soft': '#e4ecf5',
        fg: '#141413',
        'fg-2': '#3d3d3a',
        muted: '#504e49',
        meta: '#6b6a64',
        'kami-border': '#e8e6dc',
        'kami-border-soft': '#e5e3d8',
      },
      fontFamily: {
        display: ['Charter', 'Georgia', 'Noto Serif SC', 'serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      maxWidth: {
        container: '1080px',
      },
      borderRadius: {
        kami: '8px',
        'kami-lg': '12px',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: 創建 postcss.config.cjs**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: 創建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>開放潮州話 OpenTeochew</title>
</head>
<body class="bg-parchment text-fg font-body">
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: 創建 web/.gitignore**

```
node_modules
dist
```

- [ ] **Step 7: 創建 tokens.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #f5f4ed;
    color: #141413;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", system-ui, sans-serif;
  }
}
```

- [ ] **Step 8: 創建 main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 9: 安裝依賴**

Run: `cd web && npm install`
Expected: 依賴安裝成功

- [ ] **Step 10: Commit**

```bash
git add web/
git commit -m "feat: initialize Vue 3 + Vite + Tailwind frontend"
```

---

## Task 2: 前端路由 + App.vue 骨架

**Files:**
- Create: `web/src/App.vue`
- Create: `web/src/router/index.js`
- Create: `web/src/pages/HomePage.vue`
- Create: `web/src/pages/tshue/SearchHome.vue`
- Create: `web/src/pages/tshue/SearchResults.vue`
- Create: `web/src/pages/tshue/EntryDetail.vue`
- Create: `web/src/pages/thak/ReadHome.vue`
- Create: `web/src/pages/thak/ArticleReader.vue`
- Create: `web/src/pages/thak/SourceViewer.vue`

- [ ] **Step 1: 創建 router/index.js**

```js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomePage.vue')
  },
  {
    path: '/tshue',
    name: 'SearchHome',
    component: () => import('../pages/tshue/SearchHome.vue')
  },
  {
    path: '/tshue/results',
    name: 'SearchResults',
    component: () => import('../pages/tshue/SearchResults.vue')
  },
  {
    path: '/tshue/entry/:id',
    name: 'EntryDetail',
    component: () => import('../pages/tshue/EntryDetail.vue'),
    props: true
  },
  {
    path: '/thak',
    name: 'ReadHome',
    component: () => import('../pages/thak/ReadHome.vue')
  },
  {
    path: '/thak/article/:id',
    name: 'ArticleReader',
    component: () => import('../pages/thak/ArticleReader.vue'),
    props: true
  },
  {
    path: '/thak/source/:id',
    name: 'SourceViewer',
    component: () => import('../pages/thak/SourceViewer.vue'),
    props: true
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const titles = {
  Home: '開放潮州話 OpenTeochew',
  SearchHome: '查 Tshue — 開放潮州話',
  SearchResults: '搜尋結果 — 開放潮州話',
  EntryDetail: '詞條 — 開放潮州話',
  ReadHome: '讀 Thak — 開放潮州話',
  ArticleReader: '閱讀 — 開放潮州話',
  SourceViewer: '來源 — 開放潮州話'
}

router.afterEach((to) => {
  document.title = titles[to.name] || '開放潮州話 OpenTeochew'
})

export default router
```

- [ ] **Step 2: 創建 App.vue**

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <TopNav />
    <main class="flex-1">
      <router-view />
    </main>
    <footer class="py-6 border-t border-kami-border text-center text-muted text-sm">
      <div class="max-w-container mx-auto px-8">
        <p>&copy; 2026 OpenTeochew 開放潮州話</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import TopNav from './components/TopNav.vue'
</script>
```

- [ ] **Step 3: 創建所有頁面組件為佔位骨架**

每個頁面組件使用統一的佔位格式。以下是全部頁面組件的內容：

**HomePage.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-5xl font-medium text-fg mb-4">開放潮州話</h1>
    <p class="text-muted text-lg">OpenTeochew — 潮州話語言資源平台</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
      <router-link to="/tshue"
        class="block p-8 bg-ivory rounded-kami-lg border border-kami-border hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <h2 class="font-display text-2xl font-medium text-fg">查 Tshue</h2>
        <p class="text-muted mt-2">多欄位字典搜尋</p>
      </router-link>
      <router-link to="/thak"
        class="block p-8 bg-ivory rounded-kami-lg border border-kami-border hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <h2 class="font-display text-2xl font-medium text-fg">讀 Thak</h2>
        <p class="text-muted mt-2">閱讀字典與語料</p>
      </router-link>
    </div>
  </div>
</template>
```

**SearchHome.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">查 Tshue</h1>
    <p class="text-muted">搜尋首頁（待實現）</p>
  </div>
</template>
```

**SearchResults.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">搜尋結果</h1>
    <p class="text-muted">搜尋結果頁（待實現）</p>
  </div>
</template>
```

**EntryDetail.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">詞條詳情</h1>
    <p class="text-muted">詞條 #{{ id }}（待實現）</p>
  </div>
</template>

<script setup>
defineProps({ id: { type: [String, Number], required: true } })
</script>
```

**ReadHome.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">讀 Thak</h1>
    <p class="text-muted">閱讀首頁（待實現）</p>
  </div>
</template>
```

**ArticleReader.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">文章閱讀</h1>
    <p class="text-muted">文章 #{{ id }}（待實現）</p>
  </div>
</template>

<script setup>
defineProps({ id: { type: [String, Number], required: true } })
</script>
```

**SourceViewer.vue:**
```vue
<template>
  <div class="max-w-container mx-auto px-8 py-16">
    <h1 class="font-display text-2xl font-medium text-fg mb-8">來源查看</h1>
    <p class="text-muted">來源 #{{ id }}（待實現）</p>
  </div>
</template>

<script setup>
defineProps({ id: { type: [String, Number], required: true } })
</script>
```

- [ ] **Step 4: 創建 TopNav 組件**

```vue
<template>
  <header class="sticky top-0 z-50 bg-parchment/90 backdrop-blur-sm border-b border-kami-border">
    <div class="max-w-container mx-auto px-8 flex items-center justify-between h-14">
      <router-link to="/" class="font-display text-lg font-medium text-ink-blue">
        開放潮州話
      </router-link>
      <nav class="flex items-center gap-1">
        <router-link to="/tshue"
          class="px-3 py-1.5 rounded-kami text-sm transition-colors"
          :class="isTshueActive ? 'bg-warm-sand text-fg font-medium' : 'text-muted hover:text-fg'">
          查 Tshue
        </router-link>
        <router-link to="/thak"
          class="px-3 py-1.5 rounded-kami text-sm transition-colors"
          :class="isThakActive ? 'bg-warm-sand text-fg font-medium' : 'text-muted hover:text-fg'">
          讀 Thak
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isTshueActive = computed(() => route.path.startsWith('/tshue'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
</script>
```

- [ ] **Step 5: 驗證開發服務器啟動**

Run: `cd web && npm run dev`
Expected: Vite dev server 啟動成功，訪問 http://localhost:5173 可看到首頁

- [ ] **Step 6: Commit**

```bash
git add web/src/
git commit -m "feat: add Vue Router with hash-based routing and page skeletons"
```

---

## Task 3: 前端類型定義 + API 客戶端 + Stores

**Files:**
- Create: `web/src/types/entry.ts`
- Create: `web/src/types/source.ts`
- Create: `web/src/types/search.ts`
- Create: `web/src/api/client.ts`
- Create: `web/src/api/search.ts`
- Create: `web/src/api/entries.ts`
- Create: `web/src/api/sources.ts`
- Create: `web/src/stores/index.ts`
- Create: `web/src/stores/search.ts`
- Create: `web/src/stores/ui.ts`

- [ ] **Step 1: 創建類型定義**

**types/entry.ts:**
```ts
export interface Entry {
  id: number
  source_id: number
  section_id: number | null
  hanzi: string | null
  puj: string | null
  dp: string | null
  en: string | null
  mandarin: string | null
  ja: string | null
  page_num: number | null
  sort_order: number
}

export interface EntryDetail extends Entry {
  source: SourceSummary
  examples: Example[]
}

export interface Example {
  id: number
  teochew: string
  puj: string | null
  translation: string | null
}

export interface SourceSummary {
  id: number
  name: string
  year: string | null
}
```

**types/source.ts:**
```ts
export interface Source {
  id: number
  name: string
  name_zh: string | null
  author: string | null
  year: string | null
  type: 'scan_dict' | 'text_dict' | 'corpus' | 'wordlist'
  level: string | null
  status: string | null
  description: string | null
  cover_url: string | null
  total_entries: number
  total_pages: number
  sort_order: number
}

export interface SourceDetail extends Source {
  sections: Section[]
}

export interface Section {
  id: number
  source_id: number
  title: string
  sort_order: number
}
```

**types/search.ts:**
```ts
import type { Entry } from './entry'
import type { SourceSummary } from './source'

export interface SearchParams {
  q_hanzi?: string
  q_puj?: string
  q_dp?: string
  q_en?: string
  q_mandarin?: string
  q_ja?: string
  source_id?: number
  page?: number
  limit?: number
}

export interface SearchGroup {
  source: SourceSummary
  count: number
  entries: Entry[]
}

export interface SearchResult {
  total: number
  page: number
  groups: SearchGroup[]
}
```

- [ ] **Step 2: 創建 API 客戶端**

**api/client.ts:**
```ts
const BASE = '/api/v1'

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.pathname + url.search)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  return json.data as T
}

export { request }
```

**api/search.ts:**
```ts
import { request } from './client'
import type { SearchResult, SearchParams } from '../types/search'

export const searchApi = {
  search(params: SearchParams): Promise<SearchResult> {
    return request<SearchResult>('/api/v1/search', params as Record<string, string | number | undefined>)
  }
}
```

**api/entries.ts:**
```ts
import { request } from './client'
import type { EntryDetail } from '../types/entry'

export const entriesApi = {
  getById(id: number): Promise<EntryDetail> {
    return request<EntryDetail>(`/api/v1/entries/${id}`)
  }
}
```

**api/sources.ts:**
```ts
import { request } from './client'
import type { Source, SourceDetail } from '../types/source'
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
  }
}
```

- [ ] **Step 3: 創建 Pinia stores**

**stores/index.ts:**
```ts
export { useSearchStore } from './search'
export { useUIStore } from './ui'
```

**stores/search.ts:**
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { searchApi } from '../api/search'
import type { SearchParams, SearchResult } from '../types/search'

export const useSearchStore = defineStore('search', () => {
  const params = ref<SearchParams>({})
  const result = ref<SearchResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function search(newParams?: SearchParams) {
    if (newParams) params.value = newParams
    loading.value = true
    error.value = null
    try {
      result.value = await searchApi.search(params.value)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    params.value = {}
    result.value = null
    error.value = null
  }

  return { params, result, loading, error, search, reset }
})
```

**stores/ui.ts:**
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const activeSourceFilter = ref<number | null>(null)

  function setSourceFilter(id: number | null) {
    activeSourceFilter.value = id
  }

  return { activeSourceFilter, setSourceFilter }
})
```

- [ ] **Step 4: Commit**

```bash
git add web/src/types/ web/src/api/ web/src/stores/
git commit -m "feat: add TypeScript types, API client, and Pinia stores"
```

---

## Task 4: 前端 Composables

**Files:**
- Create: `web/src/composables/useSearch.ts`
- Create: `web/src/composables/useIntersection.ts`

- [ ] **Step 1: 創建 useSearch composable**

```ts
import { useRouter } from 'vue-router'
import { useSearchStore } from '../stores/search'
import type { SearchParams } from '../types/search'

export function useSearch() {
  const router = useRouter()
  const store = useSearchStore()

  function buildParams(rows: { field: string; value: string }[]): SearchParams {
    const params: SearchParams = {}
    for (const row of rows) {
      if (!row.value.trim()) continue
      const key = `q_${row.field}` as keyof SearchParams
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

- [ ] **Step 2: 創建 useIntersection composable**

```ts
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useIntersection(callback: (id: string) => void) {
  const observer = ref<IntersectionObserver | null>(null)
  const observedElements = ref<Map<string, HTMLElement>>(new Map())

  function observe(id: string, el: HTMLElement) {
    observedElements.value.set(id, el)
    observer.value?.observe(el)
  }

  function unobserve(el: HTMLElement) {
    observer.value?.unobserve(el)
  }

  onMounted(() => {
    observer.value = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = [...observedElements.value.entries()]
              .find(([, el]) => el === entry.target)?.[0]
            if (id) callback(id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
  })

  onBeforeUnmount(() => {
    observer.value?.disconnect()
  })

  return { observe, unobserve }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/composables/
git commit -m "feat: add useSearch and useIntersection composables"
```

---

## Task 5: 後端項目初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vite.config.ts`
- Create: `backend/wrangler.jsonc`
- Create: `backend/.gitignore`
- Create: `backend/src/index.tsx`
- Create: `backend/src/server/types/env.ts`
- Create: `backend/src/server/db/index.ts`
- Create: `backend/src/server/api.ts`

- [ ] **Step 1: 創建 backend/package.json**

```json
{
  "name": "openteochew-backend",
  "type": "module",
  "scripts": {
    "dev": "npx wrangler dev --remote",
    "build": "npx wrangler build",
    "deploy": "npx wrangler deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareBindings"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.7.5",
    "hono": "^4.10.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.2.3",
    "@cloudflare/workers-types": "^4.20251202.0",
    "@types/node": "^25.5.0",
    "typescript": "^5.9.3",
    "vite": "^6.3.5",
    "wrangler": "^4.17.0"
  }
}
```

- [ ] **Step 2: 創建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["@cloudflare/workers-types"],
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 創建 vite.config.ts**

```ts
import { defineConfig } from 'vite'
import cloudflare from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare()]
})
```

- [ ] **Step 4: 創建 wrangler.jsonc**

```jsonc
{
  "main": "src/index.tsx",
  "compatibility_date": "2025-04-01",
  "assets": {
    "directory": "public"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "openteochew-db",
      "database_id": "TODO_FILL_IN"
    }
  ]
}
```

- [ ] **Step 5: 創建 backend/.gitignore**

```
node_modules
dist
.wrangler
public
```

- [ ] **Step 6: 創建 env 類型**

**server/types/env.ts:**
```ts
export interface CloudflareBindings {
  DB: D1Database
  ASSETS: any
}
```

- [ ] **Step 7: 創建 db 輔助**

**server/db/index.ts:**
```ts
export async function query<T>(
  db: D1Database,
  sql: string,
  params?: any[]
): Promise<T[]> {
  const stmt = db.prepare(sql)
  const result = params ? await stmt.bind(...params).all() : await stmt.all()
  return result.results as T[]
}

export async function queryOne<T>(
  db: D1Database,
  sql: string,
  params?: any[]
): Promise<T | null> {
  const results = await query<T>(db, sql, params)
  return results[0] || null
}
```

- [ ] **Step 8: 創建 api.ts 路由聚合**

**server/api.ts:**
```ts
import { Hono } from 'hono'
import type { CloudflareBindings } from './types/env'
import searchRoutes from './routes/search'
import entriesRoutes from './routes/entries'
import sourcesRoutes from './routes/sources'

const api = new Hono<{ Bindings: CloudflareBindings }>()

api.route('/', searchRoutes)
api.route('/', entriesRoutes)
api.route('/', sourcesRoutes)

export default api
```

- [ ] **Step 9: 創建 index.tsx 入口**

```tsx
import { Hono } from 'hono'
import api from './server/api'
import type { CloudflareBindings } from './server/types/env'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.route('/api/v1', api)

app.get('*', async (c) => {
  try {
    if (c.env?.ASSETS) {
      const assetResponse = await c.env.ASSETS.fetch(
        new Request(c.req.url, c.req.raw)
      )
      if (assetResponse && assetResponse.status !== 404) {
        return new Response(assetResponse.body, assetResponse)
      }
    }
    if (c.env?.ASSETS) {
      const indexPath = new URL('/index.html', c.req.url).href
      const indexResponse = await c.env.ASSETS.fetch(new Request(indexPath))
      if (indexResponse) {
        return new Response(indexResponse.body, indexResponse)
      }
    }
    return c.notFound()
  } catch {
    return c.notFound()
  }
})

export default app
```

- [ ] **Step 10: 安裝後端依賴**

Run: `cd backend && npm install`
Expected: 依賴安裝成功

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat: initialize Hono + Cloudflare Workers backend"
```

---

## Task 6: 後端 API 路由 + 服務

**Files:**
- Create: `backend/src/server/schemas/search.ts`
- Create: `backend/src/server/services/search.ts`
- Create: `backend/src/server/services/entries.ts`
- Create: `backend/src/server/routes/search.ts`
- Create: `backend/src/server/routes/entries.ts`
- Create: `backend/src/server/routes/sources.ts`

- [ ] **Step 1: 創建 Zod schema**

**schemas/search.ts:**
```ts
import { z } from 'zod'

export const searchSchema = z.object({
  q_hanzi: z.string().optional(),
  q_puj: z.string().optional(),
  q_dp: z.string().optional(),
  q_en: z.string().optional(),
  q_mandarin: z.string().optional(),
  q_ja: z.string().optional(),
  source_id: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})
```

- [ ] **Step 2: 創建搜尋服務**

**services/search.ts:**
```ts
export async function searchEntries(
  db: D1Database,
  params: {
    q_hanzi?: string
    q_puj?: string
    q_dp?: string
    q_en?: string
    q_mandarin?: string
    q_ja?: string
    source_id?: number
    page: number
    limit: number
  }
) {
  const conditions: string[] = []
  const values: any[] = []

  if (params.q_hanzi) { conditions.push('e.hanzi LIKE ?'); values.push(`%${params.q_hanzi}%`) }
  if (params.q_puj) { conditions.push('e.puj LIKE ?'); values.push(`%${params.q_puj}%`) }
  if (params.q_dp) { conditions.push('e.dp LIKE ?'); values.push(`%${params.q_dp}%`) }
  if (params.q_en) { conditions.push('e.en LIKE ?'); values.push(`%${params.q_en}%`) }
  if (params.q_mandarin) { conditions.push('e.mandarin LIKE ?'); values.push(`%${params.q_mandarin}%`) }
  if (params.q_ja) { conditions.push('e.ja LIKE ?'); values.push(`%${params.q_ja}%`) }
  if (params.source_id) { conditions.push('e.source_id = ?'); values.push(params.source_id) }

  if (conditions.length === 0) {
    return { total: 0, page: params.page, groups: [] }
  }

  const where = conditions.join(' AND ')

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM entries e WHERE ${where}`
  ).bind(...values).first<{ total: number }>()

  const offset = (params.page - 1) * params.limit
  const entries = await db.prepare(
    `SELECT e.*, s.name as source_name, s.year as source_year
     FROM entries e
     JOIN sources s ON e.source_id = s.id
     WHERE ${where}
     ORDER BY e.source_id, e.sort_order
     LIMIT ? OFFSET ?`
  ).bind(...values, params.limit, offset).all()

  const groups: Map<number, { source: any; count: number; entries: any[] }> = new Map()
  for (const entry of entries.results as any[]) {
    if (!groups.has(entry.source_id)) {
      groups.set(entry.source_id, {
        source: { id: entry.source_id, name: entry.source_name, year: entry.source_year },
        count: 0,
        entries: []
      })
    }
    const group = groups.get(entry.source_id)!
    group.count++
    group.entries.push({
      id: entry.id,
      hanzi: entry.hanzi,
      puj: entry.puj,
      dp: entry.dp,
      en: entry.en,
      mandarin: entry.mandarin,
      ja: entry.ja,
      page_num: entry.page_num,
    })
  }

  return {
    total: countResult?.total || 0,
    page: params.page,
    groups: [...groups.values()]
  }
}
```

- [ ] **Step 3: 創建詞條服務**

**services/entries.ts:**
```ts
export async function getEntryById(db: D1Database, id: number) {
  const entry = await db.prepare(
    `SELECT e.*, s.name as source_name, s.year as source_year
     FROM entries e
     JOIN sources s ON e.source_id = s.id
     WHERE e.id = ?`
  ).bind(id).first<any>()

  if (!entry) return null

  const examples = await db.prepare(
    'SELECT * FROM examples WHERE entry_id = ? ORDER BY sort_order'
  ).bind(id).all()

  return {
    id: entry.id,
    hanzi: entry.hanzi,
    puj: entry.puj,
    dp: entry.dp,
    en: entry.en,
    mandarin: entry.mandarin,
    ja: entry.ja,
    page_num: entry.page_num,
    source: { id: entry.source_id, name: entry.source_name, year: entry.source_year },
    examples: (examples.results as any[]).map((ex) => ({
      teochew: ex.teochew,
      puj: ex.puj,
      translation: ex.translation,
    })),
  }
}
```

- [ ] **Step 4: 創建路由**

**routes/search.ts:**
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import { searchSchema } from '../schemas/search'
import { searchEntries } from '../services/search'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/search', zValidator('query', searchSchema, (result, c) => {
  if (!result.success) return c.json({ success: false, error: result.error }, 400)
}), async (c) => {
  const params = c.req.valid('query')
  const data = await searchEntries(c.env.DB, params)
  return c.json({ success: true, data })
})

export default routes
```

**routes/entries.ts:**
```ts
import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'
import { getEntryById } from '../services/entries'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/entries/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const data = await getEntryById(c.env.DB, id)
  if (!data) return c.json({ success: false, error: 'Entry not found' }, 404)
  return c.json({ success: true, data })
})

export default routes
```

**routes/sources.ts:**
```ts
import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/sources', async (c) => {
  const type = c.req.query('type')
  let sql = 'SELECT * FROM sources'
  const params: any[] = []
  if (type) { sql += ' WHERE type = ?'; params.push(type) }
  sql += ' ORDER BY sort_order'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

routes.get('/sources/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const source = await c.env.DB.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first()
  if (!source) return c.json({ success: false, error: 'Source not found' }, 404)

  const sections = await c.env.DB.prepare(
    'SELECT * FROM sections WHERE source_id = ? ORDER BY sort_order'
  ).bind(id).all()

  return c.json({
    success: true,
    data: { ...source, sections: sections.results }
  })
})

routes.get('/sources/:id/entries', async (c) => {
  const sourceId = Number(c.req.param('id'))
  const sectionId = c.req.query('section_id')
  const pageNum = c.req.query('page_num')
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 50)

  let sql = 'SELECT * FROM entries WHERE source_id = ?'
  const params: any[] = [sourceId]

  if (sectionId) { sql += ' AND section_id = ?'; params.push(Number(sectionId)) }
  if (pageNum) { sql += ' AND page_num = ?'; params.push(Number(pageNum)) }

  sql += ' ORDER BY sort_order LIMIT ? OFFSET ?'
  params.push(limit, (page - 1) * limit)

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

export default routes
```

- [ ] **Step 5: 驗證 TypeScript 編譯**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤（可能有 ASSETS 類型相關的 warning，可忽略）

- [ ] **Step 6: Commit**

```bash
git add backend/src/server/
git commit -m "feat: add API routes, services, and schemas for search, entries, sources"
```

---

## Task 7: 數據庫 Schema 遷移腳本

**Files:**
- Create: `scripts/001_initial_schema.sql`
- Create: `scripts/002_seed_sources.sql`

- [ ] **Step 1: 創建 schema 遷移**

**scripts/001_initial_schema.sql:**
```sql
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_zh TEXT,
  author TEXT,
  year TEXT,
  type TEXT NOT NULL DEFAULT 'text_dict',
  level TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  cover_url TEXT,
  total_entries INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
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

CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  teochew TEXT NOT NULL,
  puj TEXT,
  translation TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  page_num INTEGER NOT NULL,
  image_url TEXT,
  ocr_text TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_source ON entries(source_id);
CREATE INDEX IF NOT EXISTS idx_entries_section ON entries(section_id);
CREATE INDEX IF NOT EXISTS idx_entries_hanzi ON entries(hanzi);
CREATE INDEX IF NOT EXISTS idx_entries_puj ON entries(puj);
CREATE INDEX IF NOT EXISTS idx_entries_dp ON entries(dp);
CREATE INDEX IF NOT EXISTS idx_entries_en ON entries(en);
CREATE INDEX IF NOT EXISTS idx_entries_mandarin ON entries(mandarin);
CREATE INDEX IF NOT EXISTS idx_entries_ja ON entries(ja);
CREATE INDEX IF NOT EXISTS idx_entries_page ON entries(source_id, page_num);
CREATE INDEX IF NOT EXISTS idx_sections_source ON sections(source_id);
CREATE INDEX IF NOT EXISTS idx_pages_section ON pages(section_id);
CREATE INDEX IF NOT EXISTS idx_examples_entry ON examples(entry_id);
```

- [ ] **Step 2: 創建種子數據**

**scripts/002_seed_sources.sql:**
```sql
INSERT INTO sources (name, name_zh, author, year, type, level, status, description, sort_order) VALUES
('A Dictionary of the Swatow Dialect', '汕頭方言詞典', 'William Ashmore', '1883', 'scan_dict', 'S', 'public_domain', 'First comprehensive Swatow dialect dictionary', 1),
('A Swatow Index to the Syllabic Dictionary of Chinese', '汕頭音節字典索引', 'William Campbell', '1904', 'scan_dict', 'S', 'public_domain', 'Index to Rev. MacGillivray''s Syllabic Dictionary arranged by Swatow pronunciation', 2),
('English-Chinese Vocabulary of the Swatow Dialect', '汕頭方言英漢詞彙', 'Herbert Giles', '1877', 'scan_dict', 'A', 'public_domain', 'Early English-Chinese vocabulary for Swatow dialect', 3),
('潮汕方言詞典', '潮汕方言詞典', '林倫倫、陳暁楓', '現代', 'text_dict', 'A', 'pending', '現代潮汕方言詞典', 4),
('Primer of the Swatow Dialect', '汕頭方言入門', 'William Ashmore', '1883', 'scan_dict', 'B', 'public_domain', 'Introductory primer for learning Swatow dialect', 5);

INSERT INTO entries (source_id, hanzi, puj, dp, en, mandarin, ja, page_num, sort_order) VALUES
(1, '食', 'tsia̍h', 'ziah8', 'to eat; to take food; to consume', '吃', '食べる', 42, 1),
(1, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', 'to eat a meal', '吃飯', 'ご飯を食べる', 42, 2),
(1, '食茶', 'tsia̍h-tê', 'ziah8-de5', 'to drink tea', '喝茶', 'お茶を飲む', 42, 3),
(2, '食', 'tsia̍h', 'ziah8', 'to eat', '吃', '食べる', 156, 1),
(2, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', 'to eat rice', '吃飯', 'ご飯を食べる', 156, 2),
(3, '食', 'tsia̍h', 'ziah8', 'to eat; to drink', '吃', '食べる', 28, 1),
(3, '潮州', 'Tiê-tsiu', 'dio5-ziu1', 'Chaozhou (city/region)', '潮州', '潮州', 12, 1),
(4, '食', 'tsia̍h', 'ziah8', '吃', '吃', '食べる', NULL, 1),
(4, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', '吃飯', '吃飯', 'ご飯を食べる', NULL, 2),
(5, '食', 'tsia̍h', 'ziah8', 'to eat', '吃', '食べる', 15, 1);

INSERT INTO examples (entry_id, teochew, puj, translation, sort_order) VALUES
(1, '我欲食飯', 'Úa àiⁿ tsia̍h-pn̄g', 'I want to eat a meal', 1),
(1, '食飽未？', 'Tsia̍h-pá--bōe?', 'Have you eaten?', 2);

INSERT INTO sections (source_id, title, sort_order) VALUES
(5, 'Lesson I - First Words', 1),
(5, 'Lesson II - Food and Drink', 2);
```

- [ ] **Step 3: Commit**

```bash
git add scripts/
git commit -m "feat: add initial D1 schema and seed data migration scripts"
```

---

## Task 8: 構建腳本 + README

**Files:**
- Create: `build.sh`
- Modify: `README.md`

- [ ] **Step 1: 創建 build.sh**

```bash
#!/bin/bash
set -e

echo "Building OpenTeochew..."

STATIC_DIR="backend/public"
mkdir -p "$STATIC_DIR"
rm -rf "$STATIC_DIR"/*

if [ ! -d "web/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd web && npm install && cd ..
fi

echo "Building frontend..."
cd web && npm run build && cd ..

echo "Copying build output to backend/public..."
cp -r web/dist/* "$STATIC_DIR"/

if [ -d "$STATIC_DIR" ] && [ "$(ls -A $STATIC_DIR)" ]; then
  echo "Build complete!"
else
  echo "Error: build output copy failed"
  exit 1
fi
```

- [ ] **Step 2: 更新 README.md**

```md
# openteochew.com

開放潮州話 OpenTeochew — 開源潮州話語言資源平台。

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS |
| 後端 | Hono + TypeScript + Cloudflare Workers |
| 數據庫 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Workers + Assets |

## 開發

```bash
cd web && npm install && npm run dev     # 前端
cd backend && npm install && npm run dev # 後端
```

## 構建

```bash
./build.sh
```

## 文檔

- [設計規範](docs/DESIGN_SPEC.md)
- [系統架構](docs/design/architecture.md)
```

- [ ] **Step 3: 設置 build.sh 可執行權限**

Run: `chmod +x build.sh`

- [ ] **Step 4: Commit**

```bash
git add build.sh README.md
git commit -m "feat: add build script and update README"
```

---

## Task 9: 端到端驗證

- [ ] **Step 1: 驗證前端構建**

Run: `cd web && npm run build`
Expected: 構建成功，`web/dist/` 包含 `index.html` 和 `assets/`

- [ ] **Step 2: 驗證 build.sh**

Run: `./build.sh`
Expected: 構建成功，`backend/public/` 包含前端產物

- [ ] **Step 3: 驗證後端啟動**

Run: `cd backend && npm run dev`
Expected: Wrangler dev server 啟動（可能因為 D1 綁定未配置而報錯，這是預期的）

- [ ] **Step 4: 確認文件結構完整**

Run: `find web/src backend/src scripts -type f | sort`
Expected: 所有計劃中的文件都存在
