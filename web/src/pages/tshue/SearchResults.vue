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

<script setup>
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
</script>
