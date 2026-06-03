<template>
  <main>
    <section class="section hero-search">
      <div class="container" style="max-width: 760px;">
        <h1>查潮州話</h1>
        <p class="lead">匯集潮州話辭書與教材詞條，支持多條件檢索。</p>
        <form class="query-form" autocomplete="off" @submit.prevent="handleSubmit">
          <div class="query-rows">
            <div v-for="(row, i) in queryRows" :key="i" class="query-row">
              <select v-model="row.field" class="query-select">
                <option value="hanzi" :disabled="isFieldUsed('hanzi', i)">漢字</option>
                <option value="puj" :disabled="isFieldUsed('puj', i)">PUJ 白話字</option>
                <option value="dp" :disabled="isFieldUsed('dp', i)">DP 潮州話拼音</option>
                <option value="zh" :disabled="isFieldUsed('zh', i)">普通話</option>
                <option value="en" :disabled="isFieldUsed('en', i)">English</option>
                <option value="ja" :disabled="isFieldUsed('ja', i)">日本語</option>
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
          </div>
        </form>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>收錄來源（TOP 5）</h2>
        <div v-if="sourcesLoading" class="source-grid"><p>載入中…</p></div>
        <div v-else class="source-grid">
          <router-link v-for="s in topSources" :key="s.id" :to="{ name: 'SourceViewer', params: { id: s.id } }" class="source-card">
            <h3>{{ s.year }}·{{ s.name_zh || s.name }}</h3>
            <p class="meta-text">{{ s.name }}</p>
            <p class="meta-text">{{ s.author }}</p>
            <span class="source-count">{{ s.total_entries ? s.total_entries.toLocaleString() + ' 詞條' : '—' }}</span>
          </router-link>
        </div>
      </div>
    </section>

  </main>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useSearch } from '../../composables/useSearch'
import { sourcesApi } from '../../api/sources'

const { doSearch } = useSearch()

const FIELD_ORDER = ['hanzi', 'puj', 'dp', 'zh', 'en', 'ja']
const MUTEX = { puj: 'dp', dp: 'puj' }

const placeholders = {
  hanzi: '例：食, 潮州, 飯',
  puj: '例：tsia̍h, tsuí, hó',
  dp: '例：ziah8, zui3, ho3',
  zh: '例：吃, 潮州, 你好',
  en: '例：eat, water, good',
  ja: '例：食べる, お茶, 方言'
}

const queryRows = reactive([
  { field: 'hanzi', value: '' }
])

function isFieldUsed(field, excludeIndex) {
  for (let i = 0; i < queryRows.length; i++) {
    if (i === excludeIndex) continue
    const f = queryRows[i].field
    if (f === field) return true
    if (MUTEX[field] && f === MUTEX[field]) return true
  }
  return false
}

function addRow() {
  if (queryRows.length >= 3) return
  const nextField = FIELD_ORDER.find(f => !isFieldUsed(f, -1))
  queryRows.push({ field: nextField || 'en', value: '' })
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

const topSources = computed(() =>
  [...sources.value].sort((a, b) => (b.total_entries || 0) - (a.total_entries || 0)).slice(0, 5)
)

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
