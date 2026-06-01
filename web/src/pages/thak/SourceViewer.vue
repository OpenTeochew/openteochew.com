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
                <span class="ocr-char">{{ e.hanzi }}<OrigIndicator :orig="e.han_orig" /></span><span class="ocr-puj">{{ e.puj }}</span>
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
                <span class="entry-link-char">{{ e.hanzi }}<OrigIndicator :orig="e.han_orig" /></span>
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

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { sourcesApi } from '../../api/sources'
import OrigIndicator from '../../components/OrigIndicator.vue'

const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const source = ref(null)
const viewMode = ref('scan')
const pageNum = ref(1)
const sidebarQuery = ref('')
const entries = ref([])
const pages = ref([])

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
</script>
