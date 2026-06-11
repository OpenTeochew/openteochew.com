<template>
  <div>
    <div class="search-bar">
      <div class="container">
        <form autocomplete="off" @submit.prevent="handleSearch">
          <div class="query-rows">
            <div v-for="(row, i) in queryRows" :key="i" class="query-row">
              <select v-model="row.field" class="query-select">
                <option value="hanzi" :disabled="isFieldUsed('hanzi', i)">{{ t2s('漢字') }}</option>
                <option value="puj" :disabled="isFieldUsed('puj', i)">{{ t2s('PUJ 白話字') }}</option>
                <option value="dp" :disabled="isFieldUsed('dp', i)">{{ t2s('DP 潮州話拼音') }}</option>
                <option value="zh" :disabled="isFieldUsed('zh', i)">{{ t2s('普通話') }}</option>
                <option value="en" :disabled="isFieldUsed('en', i)">English</option>
                <option value="ja" :disabled="isFieldUsed('ja', i)">日本語</option>
              </select>
              <input v-model="row.value" type="text" class="query-input" :placeholder="placeholders[row.field]">
              <button type="button" class="query-remove" :class="{ hidden: queryRows.length <= 1 }" :title="t2s('移除此條件')" @click="removeRow(i)">&times;</button>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap;">
            <button type="button" class="query-add" @click="addRow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {{ t2s('新增條件') }}
            </button>
            <button type="submit" class="search-bar-btn">{{ t2s('查') }} Chhê</button>
          </div>
        </form>
      </div>
    </div>
    <main class="section">
      <div class="container">
        <div v-if="store.loading" style="text-align:center;padding:60px 0;color:var(--muted)">{{ t2s('搜尋中…') }}</div>
        <div v-else-if="store.error" style="text-align:center;padding:60px 0;color:var(--muted)">{{ store.error }}</div>
        <template v-else-if="store.result">
          <div class="results-header">
            <p class="results-count">{{ t2s('找到') }} <strong>{{ total }}</strong> {{ t2s('筆結果') }}（{{ groups.length }} {{ t2s('個來源') }}）</p>
            <div class="filter-chips">
              <button v-for="(f, i) in filters" :key="f" class="filter-chip" :class="{ active: activeFilter === i }" @click="activeFilter = i">{{ f }}</button>
            </div>
          </div>

          <div v-for="group in filteredGroups" :key="group.source.id" class="source-group">
            <div class="source-group-head" @click="toggleCollapse(group.source.id)">
              <svg class="collapse-arrow" :class="{ collapsed: collapsedSources.has(group.source.id) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              <span class="source-group-title">{{ group.source.year ? group.source.year + '·' : '' }}{{ t2s(group.source.name_zh || group.source.name) }}</span>
              <span class="source-group-count">{{ group.count }} {{ t2s('筆') }}</span>
            </div>
            <div v-show="!collapsedSources.has(group.source.id)">
              <table class="results-table">
                <thead><tr><th>{{ t2s('漢字') }}</th><th>PUJ</th><th>DP</th><th>{{ t2s('釋義') }}</th><th>{{ t2s('頁碼') }}</th><th>{{ t2s('原冊') }}</th></tr></thead>
                <tbody>
                  <tr v-for="entry in group.entries" :key="entry.id">
                    <td class="rt-char">
                      <span v-html="formatField(entry.han, entry.han_orig)"></span>
                      <span v-if="isDifferent(entry.han)" class="rt-simplified"><span class="simplified-badge">简</span>{{ t2s(entry.han) }}</span>
                    </td>
                    <td class="rt-puj" v-html="formatField(entry.puj, entry.puj_orig)"></td>
                    <td class="rt-dp">{{ entry.dp }}</td>
                    <td class="rt-def">
                      <span v-html="formatField(entry.en, entry.en_orig)"></span>
                      <span v-if="isDifferent(entry.en)" class="rt-simplified"><span class="simplified-badge">简</span>{{ t2s(entry.en) }}</span>
                    </td>
                    <td class="rt-page">{{ entry.page_num ? `p.${entry.page_num}` : '' }}</td>
                    <td class="rt-src">
                      <router-link
                        v-if="entry.page_num"
                        :to="{ name: 'SourceViewer', params: { id: group.source.id }, query: { page: entry.page_num } }"
                        class="src-link"
                        :title="t2s('睇原冊')"
                        target="_blank"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                      </router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button v-if="group.hasMore" type="button" class="show-more-btn" @click="loadMore(group)">
                {{ moreLoading === group.source.id ? t2s('載入中…') : t2s('顯示更多') + '（' + t2s('還有') + ' ' + (group.count - group.entries.length) + ' ' + t2s('筆') + '）' }}
              </button>
              <button type="button" class="collapse-btn" @click="toggleCollapse(group.source.id)">{{ t2s('收起') }}</button>
            </div>
          </div>
        </template>
        <div v-else style="text-align:center;padding:60px 0;color:var(--muted)">{{ t2s('請輸入搜尋條件') }}</div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSearchStore } from '../../stores/search'
import { useSearch } from '../../composables/useSearch'
import { searchApi } from '../../api/search'
import { formatField } from '../../composables/formatField'
import { useSimplified } from '../../composables/useSimplified'
const { simplified, t2s, isDifferent } = useSimplified()

const route = useRoute()
const store = useSearchStore()
const { doSearch } = useSearch()

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

const activeFilter = ref(0)
const moreLoading = ref(null)
const groupMoreData = reactive({})
const collapsedSources = reactive(new Set())

function toggleCollapse(sourceId) {
  if (collapsedSources.has(sourceId)) collapsedSources.delete(sourceId)
  else collapsedSources.add(sourceId)
}

const groups = computed(() => {
  const apiGroups = store.result?.groups || []
  return apiGroups.map(g => {
    const extra = groupMoreData[g.source.id] || []
    const allEntries = [...g.entries, ...extra]
    const hasMore = allEntries.length < g.count
    return { ...g, entries: allEntries, hasMore }
  }).sort((a, b) => (a.source.year || '').localeCompare(b.source.year || ''))
})
const total = computed(() => store.result?.total || 0)

const filters = computed(() => {
  const names = groups.value.map(g => `${g.source.year ? g.source.year + '·' : ''}${t2s(g.source.name_zh || g.source.name)}`)
  return [t2s('全部來源'), ...names]
})

const filteredGroups = computed(() => {
  if (activeFilter.value === 0) return groups.value
  return groups.value.filter((_, i) => i === activeFilter.value - 1)
})

async function loadMore(group) {
  const sourceId = group.source.id
  moreLoading.value = sourceId
  const nextPage = Math.floor(group.entries.length / 20) + 1
  try {
    const result = await searchApi.search({ ...store.params, source_id: sourceId, page: nextPage, limit: 20 })
    if (result.groups.length > 0) {
      if (!groupMoreData[sourceId]) groupMoreData[sourceId] = []
      groupMoreData[sourceId].push(...result.groups[0].entries)
    }
  } finally {
    moreLoading.value = null
  }
}

  function addRow() {
  if (queryRows.length >= 3) return
  const nextField = FIELD_ORDER.find(f => !isFieldUsed(f, -1))
  queryRows.push({ field: nextField || 'en', value: '' })
}

function removeRow(i) {
  if (queryRows.length > 1) queryRows.splice(i, 1)
}

function handleSearch() {
  const hasInput = queryRows.some(r => r.value.trim())
  if (hasInput) doSearch(queryRows)
}

const API_TO_FIELD = { han: 'hanzi', puj: 'puj', dp: 'dp', en: 'en', mandarin: 'zh', ja: 'ja' }

function restoreFromQuery(query) {
  queryRows.splice(0, queryRows.length, { field: 'hanzi', value: '' })
  let filled = false
  for (const [k, v] of Object.entries(query)) {
    if (v && k.startsWith('q_')) {
      const apiField = k.slice(2)
      const field = API_TO_FIELD[apiField] || apiField
      if (!filled) {
        queryRows[0] = { field, value: String(v) }
        filled = true
      } else {
        queryRows.push({ field, value: String(v) })
      }
    }
  }
  return filled
}

function runSearch(query) {
  restoreFromQuery(query)
  Object.keys(groupMoreData).forEach(k => delete groupMoreData[k])
  const { buildParams } = useSearch()
  const params = buildParams(queryRows)
  store.search(params)
}

onMounted(() => {
  const hasUrlParams = Object.keys(route.query).some(k => k.startsWith('q_'))
  if (hasUrlParams) {
    runSearch(route.query)
  } else if (store.result && store.params) {
    restoreFromQuery(store.params)
  }
})

watch(() => route.query, (query) => {
  const hasUrlParams = Object.keys(query).some(k => k.startsWith('q_'))
  if (hasUrlParams) runSearch(query)
})
</script>
