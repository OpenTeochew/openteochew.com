<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('載入中…') }}</div>
  <div v-else-if="!source" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('來源未找到') }}</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › <span style="color:var(--fg)">{{ source.name }}{{ source.name_zh && source.name_zh !== source.name ? '（' + t2s(source.name_zh) + '）' : '' }}</span>
    </div>
    <div class="container dict-header">
      <div class="dict-header-inner">
        <div>
          <h1>{{ t2s(source.name) }}{{ source.name_zh && source.name_zh !== source.name ? '（' + t2s(source.name_zh) + '）' : '' }}</h1>
          <p class="meta-text">{{ [t2s(source.author), source.publisher && t2s(source.publisher), source.year].filter(Boolean).join(' · ') }}</p>
          <div v-if="source.description" class="dict-desc" v-html="marked.parse(t2s(source.description))"></div>
          <div v-if="source.scan_source || source.proofread_note" class="dict-meta">
            <span v-if="source.scan_source" class="dict-meta-item">{{ t2s('掃描影像') }}：{{ t2s(source.scan_source) }}</span>
            <span v-if="source.proofread_note" class="dict-meta-item">{{ t2s('校訂') }}：{{ t2s(source.proofread_note) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="container dict-toolbar">
      <div class="dict-page-nav">
        <button class="dict-page-btn" :disabled="pageNum <= 1" @click="goPrev">← <span class="hide-mobile">{{ t2s('上一頁') }}</span></button>
        <span class="dict-page-num">{{ t2s('第') }} {{ pageNum }} / {{ source.total_pages || '?' }} {{ t2s('頁') }}</span>
        <button class="dict-page-btn" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNext"><span class="hide-mobile">{{ t2s('下一頁') }}</span> →</button>
        <input class="dict-page-jump" type="number" min="1" :max="source.total_pages || ''" v-model.number="jumpTarget" @keyup.enter="jumpToPage" :placeholder="t2s('跳頁')" />
        <button class="dict-page-btn" @click="jumpToPage" :disabled="!canJump"><span class="hide-mobile">{{ t2s('跳轉') }}</span><span class="show-mobile">Go</span></button>
      </div>
      <div class="dict-toolbar-right">
        <div v-if="renderedOcr" class="ocr-version-toggle">
          <button :class="{ active: ocrVersion === 'modified' }" @click="ocrVersion = 'modified'">{{ t2s('校訂版') }}</button>
          <button :class="{ active: ocrVersion === 'original' }" @click="ocrVersion = 'original'">{{ t2s('原版') }}</button>
        </div>
        <button class="dict-scan-toggle" :class="{ open: scanOpen }" @click="scanOpen = !scanOpen">
          <svg v-if="!scanOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          {{ scanOpen ? t2s('關閉原冊') : t2s('睇原冊') }}
        </button>
      </div>
    </div>
    <div class="container" style="padding-top:0">
      <div class="dict-split" :class="{ 'scan-open': scanOpen }">
        <div class="ocr-main">
          <div v-if="renderedOcr" class="ocr-entries" v-html="renderedOcr"></div>
          <div v-else class="ocr-entries" style="text-align:center;padding:60px 0;color:var(--muted)">{{ t2s('此頁無 OCR 文字') }}</div>
        </div>
        <div class="scan-panel" :class="{ open: scanOpen }">
            <div class="scan-panel-bar">
              <button class="scan-panel-close" @click="scanOpen = false" :aria-label="t2s('關閉')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
             <div class="scan-panel-inner">
              <div class="scan-image">
                <img v-if="pageImageUrl" :src="pageImageUrl" :alt="t2s('第') + ' ' + pageNum + ' ' + t2s('頁')" style="max-width:100%;max-height:100%;object-fit:contain;cursor:pointer" @error="imgError = true" @click="openLightbox">
                <div v-if="!pageImageUrl || imgError" class="scan-image-ph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <p>{{ t2s('原冊掃描頁面') }}<br><span style="font-size:12px;color:var(--meta)">{{ t2s('第') }} {{ pageNum }} {{ t2s('頁') }} · {{ source?.name }}{{ source?.name_zh && source.name_zh !== source.name ? '（' + source.name_zh + '）' : '' }}</span></p>
                </div>
              </div>
              <div class="scan-panel-nav">
                <button class="dict-page-btn" :disabled="pageNum <= 1" @click="goPrev">← {{ t2s('上一頁') }}</button>
                <span class="dict-page-num">{{ t2s('第') }} {{ pageNum }} / {{ source.total_pages || '?' }} {{ t2s('頁') }}</span>
                <button class="dict-page-btn" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNext">{{ t2s('下一頁') }} →</button>
              </div>
            </div>
        </div>
      </div>
      <div class="dict-toolbar" style="border-top:1px solid var(--border);border-bottom:none">
        <div class="dict-page-nav">
          <button class="dict-page-btn" :disabled="pageNum <= 1" @click="goPrev">← <span class="hide-mobile">{{ t2s('上一頁') }}</span></button>
          <span class="dict-page-num">{{ t2s('第') }} {{ pageNum }} / {{ source.total_pages || '?' }} {{ t2s('頁') }}</span>
          <button class="dict-page-btn" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNext"><span class="hide-mobile">{{ t2s('下一頁') }}</span> →</button>
          <input class="dict-page-jump" type="number" min="1" :max="source.total_pages || ''" v-model.number="jumpTarget" @keyup.enter="jumpToPage" :placeholder="t2s('跳頁')" />
          <button class="dict-page-btn" @click="jumpToPage" :disabled="!canJump"><span class="hide-mobile">{{ t2s('跳轉') }}</span><span class="show-mobile">Go</span></button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="lightboxOpen" class="lightbox-overlay" @click.self="closeLightbox">
    <button class="lightbox-close" @click="closeLightbox" :aria-label="t2s('關閉')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <button class="lightbox-nav lightbox-prev" :disabled="pageNum <= 1" @click="goPrevLightbox">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <img v-if="pageImageUrl" class="lightbox-img" :src="pageImageUrl" :alt="t2s('第') + ' ' + pageNum + ' ' + t2s('頁')" />
    <button class="lightbox-nav lightbox-next" :disabled="pageNum >= (source.total_pages || Infinity)" @click="goNextLightbox">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <div class="lightbox-counter">{{ t2s('第') }} {{ pageNum }} / {{ source.total_pages || '?' }} {{ t2s('頁') }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Marked } from 'marked'
import { sourcesApi } from '../../api/sources'
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()

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
const pages = ref([])
const jumpTarget = ref(null)
const lightboxOpen = ref(false)

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
    const [sourceResult, pagesResult] = await Promise.all([
      sourcesApi.getById(Number(props.id)),
      sourcesApi.getPages(Number(props.id), { page_num: pageNum.value })
    ])
    source.value = sourceResult
    pages.value = pagesResult
    const raw = sourceResult.name + (sourceResult.name_zh && sourceResult.name_zh !== sourceResult.name ? `（${sourceResult.name_zh}）` : '') + ' — 潮州話開放資料庫'
    document.documentElement.dataset.origTitle = raw
    document.title = t2s(raw)
  } catch (e) {
    console.error('Failed to load source:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(scanOpen, (val) => {
  if (val && window.innerWidth <= 920) {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    document.body.dataset.scrollY = scrollY
  } else {
    const scrollY = Number(document.body.dataset.scrollY || 0)
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.overflow = ''
    delete document.body.dataset.scrollY
    if (scrollY) window.scrollTo(0, scrollY)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onLightboxKeydown)
  const scrollY = Number(document.body.dataset.scrollY || 0)
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.overflow = ''
  delete document.body.dataset.scrollY
  if (scrollY) window.scrollTo(0, scrollY)
})

watch(pageNum, async () => {
  imgError.value = false
  router.replace({ query: { ...route.query, page: pageNum.value } })
  try {
    const pagesResult = await sourcesApi.getPages(Number(props.id), { page_num: pageNum.value })
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

const currentPage = computed(() => pages.value[0] || null)

const renderedOcr = computed(() => {
  const text = currentPage.value?.ocr_text
  if (!text) return ''
  return renderOcrVersion(text, ocrVersion.value)
})

const pageImageUrl = computed(() => {
  return currentPage.value?.image_url || null
})

function openLightbox() {
  lightboxOpen.value = true
  document.addEventListener('keydown', onLightboxKeydown)
}

function closeLightbox() {
  lightboxOpen.value = false
  document.removeEventListener('keydown', onLightboxKeydown)
}

function goPrevLightbox() {
  if (pageNum.value > 1) pageNum.value--
}

function goNextLightbox() {
  pageNum.value++
}

function onLightboxKeydown(e) {
  if (e.key === 'Escape') {
    closeLightbox()
  } else if (e.key === 'ArrowLeft') {
    goPrevLightbox()
  } else if (e.key === 'ArrowRight') {
    goNextLightbox()
  }
}
</script>
