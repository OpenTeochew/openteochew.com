<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!source" style="text-align:center;padding:80px 0;color:var(--muted)">來源未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › <router-link :to="{ name: 'ReadHome' }">字典原冊</router-link> › <span style="color:var(--fg)">{{ source.name }}{{ source.name_zh ? '（' + source.name_zh + '）' : '' }}</span>
    </div>
    <div class="container dict-header">
      <div class="dict-header-inner">
        <div>
          <h1>{{ source.name }}{{ source.name_zh ? '（' + source.name_zh + '）' : '' }}</h1>
          <p class="meta-text">{{ [source.author, source.year].filter(Boolean).join(' · ') }}</p>
        </div>
      </div>
    </div>
    <div class="container dict-toolbar">
      <div class="dict-page-nav">
        <button class="dict-page-btn" :disabled="pageNum <= 1" @click="goPrev">← <span class="hide-mobile">上一頁</span></button>
        <span class="dict-page-num">第 {{ pageNum }} / {{ source.total_pages || '?' }} 頁</span>
        <button class="dict-page-btn" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNext"><span class="hide-mobile">下一頁</span> →</button>
        <input class="dict-page-jump" type="number" min="1" :max="source.total_pages || ''" v-model.number="jumpTarget" @keyup.enter="jumpToPage" placeholder="跳頁" />
        <button class="dict-page-btn" @click="jumpToPage" :disabled="!canJump"><span class="hide-mobile">跳轉</span><span class="show-mobile">Go</span></button>
      </div>
      <div class="dict-toolbar-right">
        <div v-if="renderedOcr" class="ocr-version-toggle">
          <button :class="{ active: ocrVersion === 'modified' }" @click="ocrVersion = 'modified'">校訂版</button>
          <button :class="{ active: ocrVersion === 'original' }" @click="ocrVersion = 'original'">原版</button>
        </div>
        <button class="dict-scan-toggle" :class="{ open: scanOpen }" @click="scanOpen = !scanOpen">
          <svg v-if="!scanOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          {{ scanOpen ? '關閉原冊' : '睇原冊' }}
        </button>
      </div>
    </div>
    <div class="container" style="padding-top:0">
      <div class="dict-split" :class="{ 'scan-open': scanOpen }">
        <div class="ocr-main">
          <div v-if="renderedOcr" class="ocr-entries" v-html="renderedOcr"></div>
          <div v-else class="ocr-entries">
            <div v-for="e in entries" :key="e.id" class="ocr-entry">
              <div class="ocr-headline">
                <span v-if="e.han" class="ocr-char">{{ e.han }}<OrigIndicator :orig="e.han_orig" /></span>
                <span class="ocr-puj">{{ e.puj }}</span>
              </div>
              <p class="ocr-def">{{ e.en }}</p>
            </div>
          </div>
        </div>
        <aside class="entry-sidebar">
          <p class="sidebar-title">本頁詞條<span v-if="filteredEntries.length" class="sidebar-count">{{ filteredEntries.length }}</span></p>
          <div class="sidebar-search"><input v-model="sidebarQuery" type="text" class="sidebar-input" placeholder="在本頁搜索…" @input="sidebarLimit = SIDEBAR_PAGE_SIZE"></div>
          <ul class="entry-list">
            <li v-for="e in visibleEntries" :key="e.id" class="entry-item">
              <router-link :to="{ name: 'EntryDetail', params: { id: e.id } }" class="entry-link">
                <span v-if="e.han" class="entry-link-char">{{ e.han }}<OrigIndicator :orig="e.han_orig" /></span>
                <span class="entry-link-puj" :class="{ 'entry-link-puj--head': !e.han }">{{ e.puj }}</span>
                <span class="entry-link-def">{{ e.en }}</span>
              </router-link>
            </li>
          </ul>
          <button v-if="filteredEntries.length > sidebarLimit" class="sidebar-more" @click="sidebarLimit = filteredEntries.length">
            顯示全部 {{ filteredEntries.length }} 條
          </button>
        </aside>
        <div class="scan-panel" :class="{ open: scanOpen }">
          <div class="scan-panel-inner">
            <button class="scan-close" @click="scanOpen = false" aria-label="關閉原冊">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="scan-image">
              <img v-if="pageImageUrl" :src="pageImageUrl" :alt="`第 ${pageNum} 頁`" style="max-width:100%;max-height:100%;object-fit:contain;" @error="imgError = true">
              <div v-if="!pageImageUrl || imgError" class="scan-image-ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p>原冊掃描頁面<br><span style="font-size:12px;color:var(--meta)">第 {{ pageNum }} 頁 · {{ source?.name }}{{ source?.name_zh ? '（' + source.name_zh + '）' : '' }}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dict-toolbar" style="border-top:1px solid var(--border);border-bottom:none">
        <div class="dict-page-nav">
          <button class="dict-page-btn" :disabled="pageNum <= 1" @click="goPrev">← <span class="hide-mobile">上一頁</span></button>
          <span class="dict-page-num">第 {{ pageNum }} / {{ source.total_pages || '?' }} 頁</span>
          <button class="dict-page-btn" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNext"><span class="hide-mobile">下一頁</span> →</button>
          <input class="dict-page-jump" type="number" min="1" :max="source.total_pages || ''" v-model.number="jumpTarget" @keyup.enter="jumpToPage" placeholder="跳頁" />
          <button class="dict-page-btn" @click="jumpToPage" :disabled="!canJump"><span class="hide-mobile">跳轉</span><span class="show-mobile">Go</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Marked } from 'marked'
import { sourcesApi } from '../../api/sources'
import OrigIndicator from '../../components/OrigIndicator.vue'

const marked = new Marked({ gfm: true, breaks: true })

const route = useRoute()
const router = useRouter()
const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const source = ref(null)
const scanOpen = ref(window.innerWidth > 920)
const ocrVersion = ref('modified')
const pageNum = ref(Number(route.query.page) || 1)
const imgError = ref(false)
const sidebarQuery = ref('')
const SIDEBAR_PAGE_SIZE = 10
const sidebarLimit = ref(SIDEBAR_PAGE_SIZE)
const entries = ref([])
const pages = ref([])
const jumpTarget = ref(null)

const canJump = computed(() => {
  const v = jumpTarget.value
  const max = source.value?.total_pages
  return Number.isFinite(v) && v >= 1 && v <= (max || Infinity) && v !== pageNum.value
})

function jumpToPage() {
  if (!canJump.value) return
  pageNum.value = jumpTarget.value
  jumpTarget.value = null
}

const ORIG_RE = /~~([^~]+)~~\(([^)]+)\)/g
const INS_RE = /\+\+([^+]*)\+\+/g
const ANNO_RE = /\[([^\]\d]+)\]/g
const ATTR_RE = /\b(data-orig|data-mod)="[^"]*"/g

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function renderAnno(text) {
  return text.replace(ANNO_RE, '<sup class="ocr-anno">$1</sup>')
}

function renderOcrVersion(text, version) {
  const isOrig = version === 'original'
  const verClass = isOrig ? 'ocr-corr-orig' : 'ocr-corr-mod'
  let processed = text.replace(ORIG_RE, (_, orig, mod) => {
    const show = isOrig ? orig : mod
    const showHtml = isOrig ? show : renderAnno(show)
    return `<u class="ocr-corr ${verClass}" data-orig="${escAttr(orig)}" data-mod="${escAttr(mod)}">${showHtml}</u>`
  })
  processed = processed.replace(INS_RE, (_, ins) => {
    if (isOrig) return ''
    if (!ins.trim()) return ''
    return `<ins class="ocr-ins">${ins}</ins>`
  })
  if (!isOrig) {
    const saved = []
    processed = processed.replace(ATTR_RE, (m) => { saved.push(m); return `\x00${saved.length - 1}\x00` })
    processed = renderAnno(processed)
    processed = processed.replace(/\x00(\d+)\x00/g, (_, i) => saved[i])
  } else {
    processed = processed.replace(ANNO_RE, '')
  }
  return marked.parse(processed)
}

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
  imgError.value = false
  sidebarLimit.value = SIDEBAR_PAGE_SIZE
  router.replace({ query: { ...route.query, page: pageNum.value } })
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

function goPrev() {
  if (pageNum.value > 1) pageNum.value--
}

function goNext() {
  pageNum.value++
}

const filteredEntries = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(e =>
    (e.han || '').toLowerCase().includes(q) ||
    (e.puj || '').toLowerCase().includes(q) ||
    (e.en || '').toLowerCase().includes(q)
  )
})

const visibleEntries = computed(() => filteredEntries.value.slice(0, sidebarLimit.value))

const currentPage = computed(() => pages.value[0] || null)

const renderedOcr = computed(() => {
  const text = currentPage.value?.ocr_text
  if (!text) return ''
  return renderOcrVersion(text, ocrVersion.value)
})

const pageImageUrl = computed(() => {
  return currentPage.value?.image_url || null
})
</script>
