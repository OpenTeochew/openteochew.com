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
            <button type="submit" class="search-btn">查 Tshue</button>
            <button type="button" class="search-clear" @click="clearAll">清除</button>
          </div>
        </form>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>熱門查詢</h2>
        <div class="word-chips">
          <router-link v-for="w in hotWords" :key="w.hanzi" :to="{ name: 'SearchResults', query: { q: w.hanzi, field: 'hanzi' } }" class="word-chip">
            <span class="word-hanzi">{{ w.hanzi }}</span>
            <span class="word-puj">{{ w.puj }}</span>
          </router-link>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>收錄來源</h2>
        <div class="source-grid">
          <div v-for="s in sources" :key="s.title" class="source-card">
            <span class="source-badge">{{ s.badge }}</span>
            <h3>{{ s.title }}</h3>
            <p class="meta-text">{{ s.meta }}</p>
            <p>{{ s.desc }}</p>
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
import { reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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
  if (hasInput) router.push({ name: 'SearchResults' })
}

const hotWords = [
  { hanzi: '食', puj: 'tsia̍h' },
  { hanzi: '水', puj: 'tsuí' },
  { hanzi: '好', puj: 'hó' },
  { hanzi: '潮州', puj: 'Tiê-tsiu' },
  { hanzi: '話', puj: 'uē' },
  { hanzi: '人', puj: 'nâng' },
  { hanzi: '厝', puj: 'tshù' },
  { hanzi: '行', puj: 'kiâⁿ' },
  { hanzi: '知', puj: 'tsai' },
  { hanzi: '愛', puj: 'ài' }
]

const sources = [
  { badge: 'S 級', title: 'A Dictionary of the Swatow Dialect', meta: 'William Ashmore · 1883 · 公共領域', desc: '最早系統性的潮州話英漢字典之一，收錄大量口語詞彙與例句。' },
  { badge: 'S 級', title: 'A Swatow Index to the Syllabic Dictionary of Chinese', meta: 'William Campbell · 1904 · 公共領域', desc: '以潮州話音序編排的漢字索引，收字量大，注音精確。' },
  { badge: 'A 級', title: 'English-Chinese Vocabulary of the Vernacular or Spoken Language of Swatow', meta: 'Herbert Giles · 1877 · 公共領域', desc: '早期潮州話英漢詞彙對照，側重日常用語。' },
  { badge: 'A 級', title: '潮汕方言詞典', meta: '林倫倫、陳暁楓 · 現代 · 待確認', desc: '現代編纂的潮汕方言詞典，收錄當代潮州話詞彙。' },
  { badge: 'B 級', title: 'Primer of the Swatow Dialect', meta: 'William Ashmore · 1883 · 公共領域', desc: '潮州話入門教材，包含基礎對話與文法說明。' },
  { badge: 'B 級', title: '潮州話速成', meta: '現代教材 · 待確認', desc: '面向學習者的潮州話入門教材，附拼音對照。' }
]
</script>
