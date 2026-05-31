<template>
  <div>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › <router-link :to="{ name: 'ReadHome' }">字典原書</router-link> › <span style="color:var(--fg)">Ashmore 1883</span>
    </div>
    <div class="container dict-header">
      <div class="dict-header-inner">
        <div>
          <h1>A Dictionary of the Swatow Dialect</h1>
          <p class="meta-text">William Ashmore · 1883 · Presbyterian Mission Press · 公共領域</p>
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
            <p class="page-image-text">原書掃描頁面<br><span style="font-size:12px">第 {{ pageNum }} 頁 · Ashmore 1883</span></p>
          </div>
          <div class="ocr-overlay" :class="{ visible: viewMode === 'ocr' }">
            <div v-for="e in ocrEntries" :key="e.char" class="ocr-entry">
              <span class="ocr-char">{{ e.char }}</span><span class="ocr-puj">{{ e.puj }}</span>
              <p class="ocr-def">{{ e.def }}</p>
            </div>
          </div>
          <div class="page-nav">
            <button class="page-nav-btn" :disabled="pageNum <= 1" @click="pageNum--">← 上一頁</button>
            <span class="page-num">第 {{ pageNum }} 頁 / 共 — 頁</span>
            <button class="page-nav-btn" @click="pageNum++">下一頁 →</button>
          </div>
        </div>
        <aside class="entry-sidebar">
          <p class="sidebar-title">本頁詞條</p>
          <div class="sidebar-search"><input v-model="sidebarQuery" type="text" class="sidebar-input" placeholder="在詞條中搜索…"></div>
          <ul class="entry-list">
            <li v-for="e in filteredEntries" :key="e.char" class="entry-item">
              <router-link :to="{ name: 'EntryDetail', params: { id: '1' } }" class="entry-link">
                <span class="entry-link-char">{{ e.char }}</span>
                <span class="entry-link-puj">{{ e.puj }}</span>
                <span class="entry-link-def">{{ e.def }}</span>
              </router-link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({ id: { type: [String, Number], required: true } })

const viewMode = ref('scan')
const pageNum = ref(42)
const sidebarQuery = ref('')

const ocrEntries = [
  { char: '食', puj: 'tsia̍h', def: 'to eat; to take food; to consume. Used broadly for any act of eating or drinking.' },
  { char: '食飯', puj: 'tsia̍h-pūng', def: 'to eat a meal; to take rice. The common expression for eating.' },
  { char: '食茶', puj: 'tsia̍h-tê', def: 'to drink tea. Note: in Swatow vernacular, 食 is used for both eating and drinking.' },
  { char: '食酒', puj: 'tsia̍h-tsiú', def: 'to drink wine or spirits.' },
  { char: '食力', puj: 'tsia̍h-la̍t', def: 'to take pains; to work hard. 食力人, a hard worker.' },
  { char: '食虧', puj: 'tsia̍h-kui', def: 'to suffer loss; to be at a disadvantage.' }
]

const sidebarEntries = [
  { char: '食', puj: 'tsia̍h', def: 'to eat; to take food' },
  { char: '食飯', puj: 'tsia̍h-pūng', def: 'to eat a meal' },
  { char: '食茶', puj: 'tsia̍h-tê', def: 'to drink tea' },
  { char: '食酒', puj: 'tsia̍h-tsiú', def: 'to drink wine' },
  { char: '食力', puj: 'tsia̍h-la̍t', def: 'to work hard' },
  { char: '食虧', puj: 'tsia̍h-kui', def: 'to suffer loss' }
]

const filteredEntries = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return sidebarEntries
  return sidebarEntries.filter(e =>
    e.char.includes(q) || e.puj.toLowerCase().includes(q) || e.def.toLowerCase().includes(q)
  )
})
</script>
