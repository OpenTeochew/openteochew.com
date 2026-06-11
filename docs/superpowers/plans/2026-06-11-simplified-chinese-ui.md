# Simplified Chinese UI Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site-wide simplified Chinese toggle that converts all UI text and adds simplified translation lines in search/entry results.

**Architecture:** Pinia store (`locale.js`) manages simplified mode state and lazy-loads opencc-js. A composable (`useSimplified.js`) exposes `t2s()` for components to wrap Chinese text. TopNav gets a toggle switch showing 「简」. Results pages add simplified lines below han/definition fields.

**Tech Stack:** Vue 3, Pinia, opencc-js (frontend lazy-load), CSS toggle switch

**Spec:** `docs/superpowers/specs/2026-06-11-simplified-chinese-ui-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `web/src/stores/locale.js` | Simplified mode state + opencc-js converter |
| Create | `web/src/composables/useSimplified.js` | Expose `t2s()` and `simplified` to components |
| Modify | `web/src/main.js` | Register locale store, call init |
| Modify | `web/package.json` | Add opencc-js dependency |
| Modify | `web/src/components/TopNav.vue` | Toggle switch UI |
| Modify | `web/src/styles/tokens.css` | Toggle + simplified line styles |
| Modify | `web/src/router/index.js` | Dynamic page titles |
| Modify | `web/src/App.vue` | Wrap footer text |
| Modify | `web/src/pages/chhe/SearchHome.vue` | Wrap UI text |
| Modify | `web/src/pages/chhe/SearchResults.vue` | Wrap UI text + simplified rows |
| Modify | `web/src/pages/chhe/EntryDetail.vue` | Wrap UI text + simplified rows |
| Modify | `web/src/pages/thak/ReadHome.vue` | Wrap UI text |
| Modify | `web/src/pages/thak/ArticleReader.vue` | Wrap UI text |
| Modify | `web/src/pages/thak/SourceViewer.vue` | Wrap UI text |
| Modify | `web/src/pages/AboutPage.vue` | Wrap UI text |
| Modify | `web/src/stores/index.ts` | Export locale store |

---

### Task 1: Install opencc-js and create locale store

**Files:**
- Modify: `web/package.json`
- Create: `web/src/stores/locale.js`
- Modify: `web/src/stores/index.ts`

- [ ] **Step 1: Install opencc-js**

Run: `cd web && npm install opencc-js`

- [ ] **Step 2: Create locale store**

Create `web/src/stores/locale.js`:

```js
import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'openteochew-locale'

export const useLocaleStore = defineStore('locale', () => {
  const simplified = ref(false)
  const converter = ref(null)

  async function loadConverter() {
    if (converter.value) return
    const OpenCC = await import('opencc-js')
    converter.value = OpenCC.Converter({ from: 'tw', to: 'cn' })
  }

  async function init() {
    const pref = localStorage.getItem(STORAGE_KEY)
    if (pref === 'simplified') {
      simplified.value = true
      await loadConverter()
    }
  }

  async function toggle() {
    simplified.value = !simplified.value
    localStorage.setItem(STORAGE_KEY, simplified.value ? 'simplified' : 'traditional')
    if (simplified.value && !converter.value) {
      await loadConverter()
    }
  }

  function t2s(text) {
    if (!simplified.value || !converter.value || !text) return text
    return converter.value(text)
  }

  return { simplified, converter, init, toggle, t2s }
})
```

- [ ] **Step 3: Export from stores/index.ts**

In `web/src/stores/index.ts`, append:

```
export { useLocaleStore } from './locale'
```

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/src/stores/locale.js web/src/stores/index.ts
git commit -m "feat: add locale store with opencc-js lazy loading"
```

---

### Task 2: Create useSimplified composable

**Files:**
- Create: `web/src/composables/useSimplified.js`

- [ ] **Step 1: Create composable**

Create `web/src/composables/useSimplified.js`:

```js
import { useLocaleStore } from '../stores/locale'

export function useSimplified() {
  const locale = useLocaleStore()
  return {
    simplified: locale.simplified,
    t2s: locale.t2s
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/composables/useSimplified.js
git commit -m "feat: add useSimplified composable"
```

---

### Task 3: Add toggle switch to TopNav

**Files:**
- Modify: `web/src/components/TopNav.vue`
- Modify: `web/src/styles/tokens.css`

- [ ] **Step 1: Update TopNav.vue template**

Replace the existing `<button class="lang-btn"...>` line with:

```html
<button class="lang-toggle" :class="{ active: locale.simplified }" @click="locale.toggle()" aria-label="切换简体">
  <span class="lang-toggle-label">简</span>
  <span class="lang-toggle-track"><span class="lang-toggle-thumb"></span></span>
</button>
```

Update `<script setup>` to:

```js
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const locale = useLocaleStore()

const isChheActive = computed(() => route.path === '/' || route.path.startsWith('/chhe'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
const isAboutActive = computed(() => route.path === '/about')
```

- [ ] **Step 2: Add toggle switch styles to tokens.css**

Replace the existing `.lang-btn` rule (line 41) with:

```css
.lang-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; color: var(--fg-2); cursor: pointer; background: none; transition: all 150ms; }
.lang-toggle:hover { border-color: var(--fg-2); }
.lang-toggle-label { font-size: 13px; }
.lang-toggle-track { position: relative; width: 28px; height: 16px; background: var(--surface-warm); border-radius: 8px; transition: background 200ms; }
.lang-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: var(--muted); border-radius: 50%; transition: all 200ms; }
.lang-toggle.active .lang-toggle-track { background: var(--accent); }
.lang-toggle.active .lang-toggle-thumb { left: 14px; background: var(--accent-on); }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/TopNav.vue web/src/styles/tokens.css
git commit -m "feat: add simplified Chinese toggle switch in TopNav"
```

---

### Task 4: Initialize locale store in App.vue

**Files:**
- Modify: `web/src/App.vue`

- [ ] **Step 1: Add locale init to App.vue**

Add import and init call. Update `<script setup>` to:

```js
import { ref, onMounted } from 'vue'
import TopNav from './components/TopNav.vue'
import { sourcesApi } from './api/sources'
import { useLocaleStore } from './stores/locale'

const totalEntries = ref(0)
const sourceCount = ref(0)
const locale = useLocaleStore()

onMounted(async () => {
  locale.init()
  try {
    const sources = await sourcesApi.getAll()
    sourceCount.value = sources.length
    totalEntries.value = sources.reduce((sum, s) => sum + (s.total_entries || 0), 0)
  } catch (e) {}
})
```

- [ ] **Step 2: Wrap footer Chinese text with t2s**

Update the footer template — wrap all Chinese text with `locale.t2s()`:

```html
<footer class="pagefoot">
  <div class="container foot-inner">
    <div class="foot-left">
      <img class="foot-logo" src="/logo.jpg" alt="OpenTeochew" />
      <span class="foot-links">
        {{ locale.t2s('相輔') }}：<a href="https://github.com/OpenTeochew" target="_blank" rel="noopener">GitHub</a>
      </span>
      <span class="foot-links">
        {{ locale.t2s('聯絡') }}：<a href="mailto:contact@openteochew.com">contact@openteochew.com</a>
      </span>
      <span class="foot-links">
        <span>&copy; 2026 OpenTeochew · CC0 {{ locale.t2s('數據') }} · MIT {{ locale.t2s('代碼') }}</span>
      </span>
    </div>
    <div class="foot-right">
      <div class="foot-stats">
        <div class="foot-stat">
          <span class="foot-stat-num">{{ totalEntries || '—' }}</span>
          <span class="foot-stat-label">{{ locale.t2s('收錄詞條') }}</span>
        </div>
        <div class="foot-stat">
          <span class="foot-stat-num">{{ sourceCount || '—' }}</span>
          <span class="foot-stat-label">{{ locale.t2s('資料來源') }}</span>
        </div>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/App.vue
git commit -m "feat: init locale store and wrap footer text"
```

---

### Task 5: Wrap SearchHome.vue UI text

**Files:**
- Modify: `web/src/pages/chhe/SearchHome.vue`

- [ ] **Step 1: Add import and wrap all Chinese text**

Add at top of `<script setup>`:
```js
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()
```

In template, wrap all Chinese text strings with `t2s()`:
- `<h1>{{ t2s('查潮州話') }}</h1>`
- `<p class="lead">{{ t2s('匯集潮州話辭書與教材詞條，支持多條件檢索。') }}</p>`
- `<option ...>{{ t2s('漢字') }}</option>` (all 6 field options)
- `title="{{ t2s('移除此條件') }}"` on remove button
- `{{ t2s('新增條件') }}` on add button
- `{{ t2s('查') }} Chhê` on submit button
- `<h2>{{ t2s('收錄來源') }}</h2>`
- `{{ t2s('載入中…') }}`
- `{{ t2s('項') }}` in source count

For `placeholders` object, wrap Chinese values:
```js
const placeholders = {
  hanzi: t2s('例：食, 睇書'),
  puj: 'Lī: tsia̍h, thóiⁿ-tsṳ',
  dp: 'Li7: ziah8, toin2 ze1',
  zh: t2s('例：吃, 看書'),
  en: 'Ex. eat, read',
  ja: '例：食べる, 本を読む'
}
```

Note: `placeholders` is static — it won't reactively update when toggling. Since the user is unlikely to toggle mid-search, this is acceptable. If reactive behavior is desired later, convert to a computed.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/chhe/SearchHome.vue
git commit -m "feat: wrap SearchHome UI text with t2s"
```

---

### Task 6: Wrap SearchResults.vue + add simplified rows

**Files:**
- Modify: `web/src/pages/chhe/SearchResults.vue`

- [ ] **Step 1: Add import**

In `<script setup>`, add:
```js
import { useSimplified } from '../../composables/useSimplified'
const { simplified, t2s } = useSimplified()
```

- [ ] **Step 2: Wrap all Chinese UI text in template**

Wrap every Chinese string with `t2s()`:
- Field option labels: `漢字`, `PUJ 白話字`, `DP 潮州話拼音`, `普通話`, `English`, `日本語`
- `title="{{ t2s('移除此條件') }}"` on remove button
- `{{ t2s('新增條件') }}` on add button
- `{{ t2s('搜尋中…') }}`
- Results count: `{{ t2s('找到') }} <strong>{{ total }}</strong> {{ t2s('筆結果') }}（{{ groups.length }} {{ t2s('個來源') }}）`
- Filter chip: `{{ t2s('全部來源') }}`
- `{{ group.count }} {{ t2s('筆') }}`
- Table headers: `{{ t2s('漢字') }}`, `{{ t2s('釋義') }}`, `{{ t2s('頁碼') }}`, `{{ t2s('原冊') }}`
- `title="{{ t2s('睇原冊') }}"` on source link
- More button: `{{ moreLoading === group.source.id ? t2s('載入中…') : t2s('顯示更多') + `（${t2s('還有')} ${group.count - group.entries.length} ${t2s('筆')}）` }}`
- Collapse button: `{{ t2s('收起') }}`
- Empty state: `{{ t2s('請輸入搜尋條件') }}`

Wrap `placeholders` object (same as SearchHome).

Wrap `filters` computed: the `'全部來源'` string.

- [ ] **Step 3: Add simplified rows to result table cells**

For han cell (line ~53), replace:
```html
<td class="rt-char" v-html="formatField(entry.han, entry.han_orig)"></td>
```
with:
```html
<td class="rt-char">
  <span v-html="formatField(entry.han, entry.han_orig)"></span>
  <span v-if="simplified && entry.han" class="rt-simplified">{{ t2s(entry.han) }}</span>
</td>
```

For definition cell (line ~56), replace:
```html
<td class="rt-def" v-html="formatField(entry.en, entry.en_orig)"></td>
```
with:
```html
<td class="rt-def">
  <span v-html="formatField(entry.en, entry.en_orig)"></span>
  <span v-if="simplified && entry.en" class="rt-simplified">{{ t2s(entry.en) }}</span>
</td>
```

- [ ] **Step 4: Add `.rt-simplified` style to tokens.css**

Append after the `.results-table` styles:

```css
.rt-simplified { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/chhe/SearchResults.vue web/src/styles/tokens.css
git commit -m "feat: wrap SearchResults UI text + add simplified rows"
```

---

### Task 7: Wrap EntryDetail.vue + add simplified rows

**Files:**
- Modify: `web/src/pages/chhe/EntryDetail.vue`

- [ ] **Step 1: Add import**

In `<script setup>`, add:
```js
import { useSimplified } from '../../composables/useSimplified'
const { simplified, t2s } = useSimplified()
```

- [ ] **Step 2: Wrap all Chinese UI text**

- Loading states: `t2s('載入中…')`, `t2s('詞條未找到')`
- Breadcrumb: `t2s('搜索')`, `t2s('詞條詳情')`
- Audio button: `t2s('播放讀音')`
- Share button: `t2s('分享')`
- Section headings: `t2s('釋義')`, `t2s('例句')`
- Def tab label: `t2s('全部來源')`
- Source link text: `t2s('原冊')`

- [ ] **Step 3: Add simplified row to entry character**

Replace the entry character display:
```html
<div class="entry-char" v-html="formatField(entry.han, entry.han_orig)"></div>
```
with:
```html
<div>
  <div class="entry-char" v-html="formatField(entry.han, entry.han_orig)"></div>
  <div v-if="simplified && entry.han" class="entry-simplified">{{ t2s(entry.han) }}</div>
</div>
```

- [ ] **Step 4: Add simplified row to example teochew**

Replace:
```html
<p class="example-teochew">{{ ex.teochew }}</p>
```
with:
```html
<p class="example-teochew">{{ ex.teochew }}<span v-if="simplified" class="rt-simplified">{{ t2s(ex.teochew) }}</span></p>
```

- [ ] **Step 5: Add `.entry-simplified` style to tokens.css**

```css
.entry-simplified { font-size: 20px; color: var(--muted); margin-top: 4px; }
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/chhe/EntryDetail.vue web/src/styles/tokens.css
git commit -m "feat: wrap EntryDetail UI text + add simplified rows"
```

---

### Task 8: Wrap ReadHome.vue UI text

**Files:**
- Modify: `web/src/pages/thak/ReadHome.vue`

- [ ] **Step 1: Add import and wrap Chinese text**

Add import:
```js
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()
```

Wrap:
- `<h1>{{ t2s('讀潮州話') }}</h1>`
- `<p class="lead">{{ t2s('瀏覽潮州話辭書與教材，所有資料標明出處，開放使用。') }}</p>`
- Cat tabs: `{{ t2s('全部') }}`, `{{ t2s('辭書') }}`, `{{ t2s('教材') }}`
- `{{ t2s('載入中…') }}`
- Source card: `{{ t2s('詞條') }}`, `{{ t2s('收錄中') }}`, `{{ t2s('頁') }}`
- `typeLabel` function values: `t2s('辭書')`, `t2s('教材')`

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/thak/ReadHome.vue
git commit -m "feat: wrap ReadHome UI text with t2s"
```

---

### Task 9: Wrap ArticleReader.vue UI text

**Files:**
- Modify: `web/src/pages/thak/ArticleReader.vue`

- [ ] **Step 1: Add import and wrap Chinese text**

Add import:
```js
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()
```

Wrap:
- `{{ t2s('載入中…') }}`, `{{ t2s('文章未找到') }}`
- Breadcrumb: `{{ t2s('語料與文本') }}`
- Tag: `{{ t2s('辭書') }}`, `{{ t2s('教材') }}`
- TOC title: `{{ t2s('目錄') }}`

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/thak/ArticleReader.vue
git commit -m "feat: wrap ArticleReader UI text with t2s"
```

---

### Task 10: Wrap SourceViewer.vue UI text

**Files:**
- Modify: `web/src/pages/thak/SourceViewer.vue`

- [ ] **Step 1: Add import and wrap Chinese text**

Add import:
```js
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()
```

Wrap:
- `{{ t2s('載入中…') }}`, `{{ t2s('來源未找到') }}`
- Breadcrumb: `{{ t2s('字典原冊') }}`
- Nav: `{{ t2s('上一頁') }}`, `{{ t2s('下一頁') }}`, `{{ t2s('第') }} {{ pageNum }} / {{ source.total_pages || '?' }} {{ t2s('頁') }}`
- Jump input placeholder: `t2s('跳頁')`
- Jump button: `{{ t2s('跳轉') }}`
- OCR version toggle: `{{ t2s('校訂版') }}`, `{{ t2s('原版') }}`
- Scan toggle: `{{ scanOpen ? t2s('關閉原冊') : t2s('睇原冊') }}`
- Close button: `{{ t2s('關閉') }}`
- `{{ t2s('此頁無 OCR 文字') }}`
- Alt text: `t2s('第') + ' ' + pageNum + ' ' + t2s('頁')`
- Placeholder: wrap the Chinese text in the scan placeholder paragraph

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/thak/SourceViewer.vue
git commit -m "feat: wrap SourceViewer UI text with t2s"
```

---

### Task 11: Wrap AboutPage.vue UI text

**Files:**
- Modify: `web/src/pages/AboutPage.vue`

- [ ] **Step 1: Add import and wrap Chinese text**

Add import:
```js
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()
```

Wrap all Chinese text:
- `<h1>{{ t2s('關於 OpenTeochew') }}</h1>`
- Lead paragraph
- `<h2>{{ t2s('核心理念') }}</h2>`
- All principle titles and descriptions

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/AboutPage.vue
git commit -m "feat: wrap AboutPage UI text with t2s"
```

---

### Task 12: Dynamic page titles

**Files:**
- Modify: `web/src/router/index.js`

- [ ] **Step 1: Make titles locale-aware**

The router is outside Vue component context. Use localStorage to check locale:

Replace the `titles` object and `afterEach` with:

```js
const titles = {
  SearchHome: '查 Chhê — 潮州話開放資料庫',
  SearchResults: '搜尋結果 — 潮州話開放資料庫',
  EntryDetail: '詞條 — 潮州話開放資料庫',
  ReadHome: '讀 Tha̍k — 潮州話開放資料庫',
  ArticleReader: '閱讀 — 潮州話開放資料庫',
  SourceViewer: '來源 — 潮州話開放資料庫',
  About: '關於 — 潮州話開放資料庫'
}

const t2sSimple = (() => {
  let converter = null
  return async (text) => {
    if (localStorage.getItem('openteochew-locale') !== 'simplified') return text
    if (!converter) {
      const OpenCC = await import('opencc-js')
      converter = OpenCC.Converter({ from: 'tw', to: 'cn' })
    }
    return converter(text)
  }
})()

router.afterEach(async (to) => {
  let title = titles[to.name] || '潮州話開放資料庫 OpenTeochew'
  title = await t2sSimple(title)
  document.title = title
})
```

Note: This loads opencc-js independently of the store. Since the user has already toggled simplified mode (localStorage is set), the store already loaded it — the dynamic import will hit the browser module cache, so no duplicate network request.

- [ ] **Step 2: Also update title on toggle**

In `web/src/stores/locale.js`, after `localStorage.setItem(...)`, add a DOM title update. Add after the toggle logic:

```js
async function toggle() {
  simplified.value = !simplified.value
  localStorage.setItem(STORAGE_KEY, simplified.value ? 'simplified' : 'traditional')
  if (simplified.value && !converter.value) {
    await loadConverter()
  }
  const titles = {
    SearchHome: '查 Chhê — 潮州話開放資料庫',
    SearchResults: '搜尋結果 — 潮州話開放資料庫',
    EntryDetail: '詞條 — 潮州話開放資料庫',
    ReadHome: '讀 Tha̍k — 潮州話開放資料庫',
    ArticleReader: '閱讀 — 潮州話開放資料庫',
    SourceViewer: '來源 — 潮州話開放資料庫',
    About: '關於 — 潮州話開放資料庫'
  }
  const route = window.location.hash.replace('#', '')
  const routeName = Object.entries({
    '/': 'SearchHome', '/chhe/results': 'SearchResults',
    '/thak': 'ReadHome', '/about': 'About'
  }).find(([path]) => route === path || route.startsWith(path + '/'))?.[1] || ''
  const base = titles[routeName] || '潮州話開放資料庫 OpenTeochew'
  document.title = t2s(base)
}
```

Actually, this is over-engineering. The router `afterEach` handles it on navigation. For the current page (no navigation), the simplest approach: dispatch a `popstate` event or just set `document.title` directly using the current route. But the toggle already triggers reactive re-renders — the simplest fix is to add a small helper.

Better approach: just set `document.title` in the toggle by reading current `document.title` and converting it:

```js
async function toggle() {
  simplified.value = !simplified.value
  localStorage.setItem(STORAGE_KEY, simplified.value ? 'simplified' : 'traditional')
  if (simplified.value && !converter.value) {
    await loadConverter()
  }
  document.title = t2s(document.title)
}
```

Wait — if toggling OFF (back to traditional), we'd be converting traditional→simplified on an already-simplified title. We need to store the original.

Simplest correct approach: store original title as data attribute. Skip the router-level complexity for now — the title updates on next navigation via `afterEach`, and we add a simple direct update in toggle:

In `locale.js` toggle:
```js
async function toggle() {
  simplified.value = !simplified.value
  localStorage.setItem(STORAGE_KEY, simplified.value ? 'simplified' : 'traditional')
  if (simplified.value && !converter.value) {
    await loadConverter()
  }
  if (simplified.value) {
    if (!document.documentElement.dataset.origTitle) {
      document.documentElement.dataset.origTitle = document.title
    }
    document.title = t2s(document.documentElement.dataset.origTitle)
  } else {
    document.title = document.documentElement.dataset.origTitle || document.title
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/router/index.js web/src/stores/locale.js
git commit -m "feat: dynamic page titles based on locale"
```

---

### Task 13: Build and verify

- [ ] **Step 1: Run build**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run dev server and manually verify**

```bash
./dev.sh
```

Verify:
1. TopNav shows 「简」toggle, default off
2. Click toggle — all UI text converts to simplified Chinese
3. Search results show simplified lines below han and definition columns
4. Entry detail shows simplified lines
5. Refresh page — simplified mode persists
6. Toggle off — everything reverts to traditional
7. Button always shows 「简」, never 「繁」

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: minor adjustments from manual verification"
```
