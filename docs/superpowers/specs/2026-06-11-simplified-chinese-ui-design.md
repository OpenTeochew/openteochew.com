# 簡體中文 UI 切換（Phase 2）

## 問題

全站 UI 文字為繁體中文硬編碼。簡體中文用戶無法以熟悉的字體使用平台。搜索結果和詞條詳情中的漢字、普通話釋義也僅顯示繁體。

## 目標

1. 用戶可開啟簡體模式，全站 UI 文字動態轉換為簡體中文
2. chhe 搜索結果表格中，漢字和釋義欄位的繁體原文下方出現簡體行
3. 偏好持久化於 localStorage，下次訪問自動恢復

## 不做的事

- 不引入 vue-i18n 或翻譯對照表
- 不修改後端 API
- 不改變數據庫存儲（保持繁體）
- 不轉換 PUJ、DP、English 等非中文欄位

## 架構

### 新增文件

| 文件 | 用途 |
|------|------|
| `web/src/stores/locale.js` | Pinia store：簡體模式狀態 + opencc-js converter |
| `web/src/composables/useSimplified.js` | Composable：暴露 `t2s(text)` 轉換函數 |

### 修改文件

| 文件 | 改動 |
|------|------|
| `web/src/components/TopNav.vue` | 啟用語言按鈕，接入 toggle |
| `web/src/styles/tokens.css` | 語言按鈕樣式（toggle 開關），簡體行樣式 |
| `web/src/router/index.js` | 頁面 title 根據 locale 動態生成 |
| `web/src/App.vue` | Footer 文字包裹 `t2s()` |
| `web/src/pages/chhe/SearchHome.vue` | UI 文字包裹 `t2s()` |
| `web/src/pages/chhe/SearchResults.vue` | UI 文字包裹 + 結果表格添加簡體行 |
| `web/src/pages/chhe/EntryDetail.vue` | UI 文字包裹 + 詞條詳情添加簡體行 |
| `web/src/pages/thak/ReadHome.vue` | UI 文字包裹 `t2s()` |
| `web/src/pages/thak/ArticleReader.vue` | UI 文字包裹 `t2s()` |
| `web/src/pages/thak/SourceViewer.vue` | UI 文字包裹 `t2s()` |
| `web/src/pages/AboutPage.vue` | UI 文字包裹 `t2s()` |

### 前端新增依賴

`web/package.json` 添加 `opencc-js`（^1.3.1，與後端同版本）。

## 詳細設計

### 1. locale store (`stores/locale.js`)

```js
// Pinia store
state:
  - simplified: boolean（false = 繁體，true = 簡體）
  - converter: Function | null（opencc-js t2s converter）

actions:
  - init()：從 localStorage 讀取偏好，若為 simplified 則加載 converter
  - toggle()：
      1. simplified = !simplified
      2. 寫入 localStorage（key: 'openteochew-locale', value: 'simplified' | 'traditional'）
      3. 若 simplified 變為 true 且 converter 為 null，動態 import('opencc-js') 初始化
```

初始化邏輯：
- localStorage key: `openteochew-locale`
- 值為 `'simplified'` 時啟用簡體模式
- 無值或 `'traditional'` 時保持繁體
- App.vue 的 `onMounted` 中調用 `locale.init()`

### 2. useSimplified composable (`composables/useSimplified.js`)

```js
// 暴露兩個東西
return {
  simplified,  // ref<boolean>，是否簡體模式
  t2s(text)    // 若 simplified && converter，返回轉換後文字；否則原樣返回
}
```

`converter` 為 `OpenCC.Converter({ from: 'tw', to: 'cn' })`（繁→簡）。

### 3. 語言切換按鈕（TopNav.vue）

**設計**：按鈕始終顯示「简」字，右側帶一個 CSS toggle 開關。

```
[ 简 ○── ]   ← 關閉狀態（繁體模式）
[ 简 ──● ]   ← 開啟狀態（簡體模式）
```

- 按鈕文字固定為「简」（簡體），不會出現「繁」字
- 開關狀態由 `locale.simplified` 控制
- 點擊觸發 `locale.toggle()`
- 移除 `.lang-btn` 的 `visibility: hidden`

### 4. UI 文字轉換

所有頁面組件中硬編碼的繁體中文文字，用 `t2s()` 包裹：

**Before:**
```html
<h1>查潮州話</h1>
```

**After:**
```html
<h1>{{ t2s('查潮州話') }}</h1>
```

涉及的文字類型：
- 頁面標題、副標題
- 按鈕文字（「新增條件」、「查 Chhê」、「顯示更多」等）
- 提示文字（「搜尋中…」、「載入中…」等）
- 麵包屑導航
- Footer 文字（「收錄詞條」、「資料來源」、「相輔」、「聯絡」）
- 路由頁面 title

**不轉換的文字**：
- PUJ、DP、English、日本語等非中文內容
- 品牌名「OpenTeochew」「BETA」
- Tab 標籤中的「Chhê」「Tha̍k」

### 5. 搜索結果簡體行（SearchResults.vue）

在結果表格中，為「漢字」和「釋義」欄位添加簡體翻譯行。

當前表格結構：`漢字 | PUJ | DP | 釋義 | 頁碼 | 原冊`

「釋義」列對應數據中的 `en` 和 `mandarin` 欄位（英文或普通話釋義，含中文內容）。簡體模式開啟時，在繁體原文下方加一行簡體。

**漢字欄**：在 `<td class="rt-char">` 內部，繁體下方加一行簡體：
```html
<td class="rt-char">
  <span v-html="formatField(entry.han, entry.han_orig)"></span>
  <span v-if="simplified && entry.han" class="rt-simplified">{{ t2s(entry.han) }}</span>
</td>
```

**釋義欄**：在 `<td class="rt-def">` 內部，繁體下方加一行簡體：
```html
<td class="rt-def">
  <span v-html="formatField(entry.en, entry.en_orig)"></span>
  <span v-if="simplified && entry.en" class="rt-simplified">{{ t2s(stripHtml(entry.en)) }}</span>
</td>
```

注意：`entry.en` 可能含 HTML 標記（來自 `formatField` 的原文註解），簡體行需要 strip HTML 後再轉換。

**簡體行只在簡體模式開啟時顯示。**

### 6. 詞條詳情簡體行（EntryDetail.vue）

- 頁面頂部大字漢字（`han`）下方加簡體行
- 釋義區塊的定義文字（`en` / `mandarin`）下方加簡體行
- 例句中的潮州話文字（`teochew`）下方加簡體行（若有中文）

### 7. 頁面 title 動態化

`router/index.js` 的 `titles` 改為函數或 computed：

```js
router.afterEach((to) => {
  const titles = { ... }
  let title = titles[to.name] || '潮州話開放資料庫 OpenTeochew'
  // 若簡體模式，轉換 title
  document.title = title
})
```

但 router 不在 Vue 組件內，無法直接用 composable。解決方案：
- 在 `afterEach` 中直接讀取 localStorage 判斷是否簡體模式
- 或用一個全局事件讓 App.vue 負責更新 title

選擇簡單方案：`afterEach` 中讀 localStorage，`locale.toggle()` 時也手動更新 `document.title`。

### 8. 樣式

**Toggle 開關**：
```css
.lang-toggle { /* 容器 */ }
.lang-toggle-track { /* 開關軌道 */ }
.lang-toggle-thumb { /* 開關圓點 */ }
.lang-toggle.active .lang-toggle-track { /* 開啟狀態軌道顏色 */ }
.lang-toggle.active .lang-toggle-thumb { /* 開啟狀態圓點位置 */ }
```

**簡體行**：
```css
.rt-simplified {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin-top: 2px;
}
```

## opencc-js 懶加載

- 庫大小：原始 ~1MB，gzip ~100-150KB
- 使用動態 `import('opencc-js')` 僅在用戶首次點擊「简」開關時加載
- 加載完成前，toggle 按鈕可顯示 loading 狀態（可選）
- 加載後存入 store，後續轉換無網絡開銷

## 成功標準

1. 點擊「简」開關，全站 UI 文字切換為簡體（導航列、頁面標題、按鈕、提示、Footer）
2. chhe 搜索結果表格中，漢字和釋義欄位繁體原文下方出現簡體行
3. chhe 詞條詳情中，漢字和定義下方出現簡體行
4. 重新整理頁面後簡體模式保持
5. 關閉簡體模式後，簡體行消失，UI 恢復繁體
6. PUJ、DP、English 等非中文欄位不受影響
7. 按鈕始終顯示「简」，不會出現「繁」字
