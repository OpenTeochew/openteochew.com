<template>
  <main>
    <section class="section hero-search">
      <div class="container" style="max-width: 760px;">
        <h1>{{ t2s('查潮州話') }}</h1>
        <p class="lead">{{ t2s('匯集潮州話辭書與教材詞條，支持多條件檢索。') }}</p>
        <form class="query-form" autocomplete="off" @submit.prevent="handleSubmit">
          <div class="query-rows">
            <div v-for="(row, i) in queryRows" :key="i" class="query-row">
              <select v-model="row.field" class="query-select">
                <option value="hanzi" :disabled="isFieldUsed('hanzi', i)">{{ t2s('漢字') }}</option>
                <option value="puj" :disabled="isFieldUsed('puj', i)">{{ t2s('PUJ 白話字') }}</option>
                <option value="dp" :disabled="isFieldUsed('dp', i)">{{ t2s('DP 潮拼') }}</option>
                <option value="zh" :disabled="isFieldUsed('zh', i)">{{ t2s('普通話') }}</option>
                <option value="en" :disabled="isFieldUsed('en', i)">English</option>
                <option value="ja" :disabled="isFieldUsed('ja', i)">日本語</option>
              </select>
              <input v-model="row.value" type="text" class="query-input" :placeholder="placeholders[row.field]">
              <button type="button" class="query-remove" :class="{ hidden: queryRows.length <= 1 }" :title="t2s('移除此條件')" @click="removeRow(i)">&times;</button>
            </div>
          </div>
          <div class="query-add-row">
            <button type="button" class="query-add" @click="addRow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {{ t2s('新增條件') }}
            </button>
          </div>
          <div class="query-actions">
            <button type="submit" class="search-btn">{{ t2s('查') }} Chhê</button>
          </div>
        </form>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>{{ t2s('收錄來源') }}</h2>
        <div v-if="sourcesLoading"><p>{{ t2s('載入中…') }}</p></div>
        <ul v-else class="source-list">
          <li v-for="(s, i) in topSources" :key="s.id">
            <span class="source-idx">{{ i + 1 }}.</span>
            <router-link :to="{ name: 'SourceViewer', params: { id: s.id } }">
              {{ s.year ? s.year + ', ' : '' }}<em>{{ s.name }}</em>{{ s.name_zh ? ' (' + t2s(s.name_zh) + ')' : '' }}{{ s.author ? ', ' + s.author : '' }} <span v-if="s.total_entries" class="source-count">{{ s.total_entries.toLocaleString() }} {{ t2s('項') }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </section>

  </main>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useSearch } from '../../composables/useSearch'
import { useSimplified } from '../../composables/useSimplified'
import { sourcesApi } from '../../api/sources'

const { doSearch } = useSearch()
const { t2s } = useSimplified()

const FIELD_ORDER = ['hanzi', 'puj', 'dp', 'zh', 'en', 'ja']
const MUTEX = { puj: 'dp', dp: 'puj' }

const placeholders = computed(() => ({
  hanzi: t2s('例：食, 睇書'),
  puj: 'Lī: tsia̍h, thóiⁿ-tsṳ',
  dp: 'Li7: ziah8, toin2 ze1',
  zh: t2s('例：吃, 看書'),
  en: 'Ex. eat, read',
  ja: '例：食べる, 本を読む'
}))

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
