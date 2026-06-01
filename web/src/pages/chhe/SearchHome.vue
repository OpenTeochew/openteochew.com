<template>
  <main>
    <section class="section hero-search">
      <div class="container" style="max-width: 760px;">
        <h1>查潮州話</h1>
        <p class="lead">匯集所有潮州話字典、詞典與語料，支持多條件檢索。</p>
        <form class="query-form" autocomplete="off" @submit.prevent="handleSubmit">
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
          <div class="query-add-row">
            <button type="button" class="query-add" @click="addRow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新增條件
            </button>
          </div>
          <div class="query-actions">
            <button type="submit" class="search-btn">查 Chhe</button>
            <button type="button" class="search-clear" @click="clearAll">清除</button>
          </div>
        </form>
      </div>
    </section>
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
    <section class="section">
      <div class="container">
        <div class="stats-row">
          <div><span class="stat-num">—</span><p class="stat-label">收錄詞條（數字化中）</p></div>
          <div><span class="stat-num">—</span><p class="stat-label">字典與詞典</p></div>
          <div><span class="stat-num">—</span><p class="stat-label">語料來源</p></div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useSearch } from '../../composables/useSearch'
import { sourcesApi } from '../../api/sources'

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

function removeRow(i) {
  if (queryRows.length > 1) queryRows.splice(i, 1)
}

function clearAll() {
  queryRows.forEach(r => { r.value = '' })
}

function handleSubmit() {
  const hasInput = queryRows.some(r => r.value.trim())
  if (hasInput) doSearch(queryRows)
}

const sources = ref([])
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
</script>
