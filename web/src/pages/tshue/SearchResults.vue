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
        <div class="results-header">
          <p class="results-count">找到 <strong>8</strong> 筆與「<strong>食</strong>」相關的結果（4 個來源）</p>
          <div class="filter-chips">
            <button v-for="(f, i) in filters" :key="f" class="filter-chip" :class="{ active: activeFilter === i }" @click="activeFilter = i">{{ f }}</button>
          </div>
        </div>

        <div v-for="group in sourceGroups" :key="group.title" class="source-group">
          <div class="source-group-head">
            <span class="source-group-title">{{ group.title }}</span>
            <span class="source-group-count">{{ group.count }} 筆</span>
          </div>
          <table class="results-table">
            <thead><tr><th>漢字</th><th>PUJ</th><th>DP</th><th>釋義</th><th>{{ group.pageLabel }}</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(row, ri) in group.rows" :key="ri" :class="{ 'hidden-row': ri > 0 && !group.expanded }" @click="$router.push({ name: 'EntryDetail', params: { id: '1' } })">
                <td class="rt-char">{{ row.char }}</td>
                <td class="rt-puj">{{ row.puj }}</td>
                <td class="rt-dp">{{ row.dp }}</td>
                <td class="rt-def">{{ row.def }}</td>
                <td class="rt-page">{{ row.page }}</td>
                <td><button class="rt-audio" @click.stop><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button></td>
              </tr>
              <tr v-if="group.rows.length > 1 && !group.expanded" class="show-more-row"><td colspan="6"><button class="show-more-btn" @click="group.expanded = true">查看更多 (共 {{ group.count }} 筆)</button></td></tr>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button v-for="p in pages" :key="p" class="page-btn" :class="{ active: p === 1 }">{{ p }}</button>
          <button class="page-btn">下一頁 →</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const placeholders = {
  puj: '例：tsia̍h, tsuí, hó',
  dp: '例：ziah8, zui3, ho3',
  hanzi: '例：食, 潮州, 飯',
  en: '例：eat, water, good',
  zh: '例：吃, 潮州, 你好',
  ja: '例：食べる, お茶, 方言'
}

const queryRows = reactive([
  { field: 'hanzi', value: '食' },
  { field: 'puj', value: 'tsia̍h' }
])

const activeFilter = ref(0)
const filters = ['全部來源', 'Ashmore 1883', 'Campbell 1904', '潮汕方言詞典', 'Giles 1877']
const pages = [1, 2, 3]

const sourceGroups = reactive([
  {
    title: 'Ashmore 1883', count: 3, pageLabel: '頁碼', expanded: false,
    rows: [
      { char: '食', puj: 'tsia̍h', dp: 'ziah8', def: 'to eat; to take food; to consume', page: 'p. 42' },
      { char: '食飯', puj: 'tsia̍h-pūng', dp: 'ziah8 bung6', def: 'to eat a meal; to take rice', page: 'p. 42' },
      { char: '食包', puj: 'tsia̍h-pau', dp: 'ziah8 bao1', def: 'to guarantee (food); to take full responsibility', page: 'p. 43' }
    ]
  },
  {
    title: 'Campbell 1904', count: 2, pageLabel: '編號', expanded: false,
    rows: [
      { char: '食', puj: 'tsia̍h', dp: 'ziah8', def: 'eat; food; meal; to live (on)', page: 'no. 3847' },
      { char: '食錫', puj: 'tsia̍h-siah', dp: 'ziah8 siah4', def: 'to be poisoned by tin; said of workers in tin mines', page: 'no. 3852' }
    ]
  },
  {
    title: '潮汕方言詞典', count: 2, pageLabel: '頁碼', expanded: false,
    rows: [
      { char: '食', puj: 'tsia̍h', dp: 'ziah8', def: '吃。泛指進食、飲用。如：食飯（吃飯）、食茶（喝茶）。', page: 'p. 128' },
      { char: '食物', puj: 'tsia̍h-mi̍h', dp: 'ziah8 mih8', def: '食物；食品', page: 'p. 129' }
    ]
  },
  {
    title: 'Giles 1877', count: 1, pageLabel: '頁碼', expanded: false,
    rows: [
      { char: '食', puj: 'tsia̍h', dp: 'ziah8', def: 'to eat; food; living; livelihood', page: 'p. 19' }
    ]
  }
])

function addRow() {
  queryRows.push({ field: 'en', value: '' })
}

function removeRow(i) {
  if (queryRows.length > 1) queryRows.splice(i, 1)
}

function handleSearch() {
  const hasInput = queryRows.some(r => r.value.trim())
  if (hasInput) {
    // refresh results
  }
}
</script>
