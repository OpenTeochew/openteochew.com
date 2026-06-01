<template>
  <main>
    <section class="section thak-hero">
      <div class="container" style="max-width: 680px;">
        <h1>讀潮州話</h1>
        <p class="lead">瀏覽原始字典頁面，閱讀語料與潮州話文本。所有資料標明出處，開放使用。</p>
        <div class="cat-tabs">
          <button v-for="(t, i) in catTabs" :key="t" class="cat-tab" :class="{ active: activeCat === i }" @click="activeCat = i">{{ t }}</button>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>字典原書</h2>
        <div v-if="loading" style="color:var(--muted)">載入中…</div>
        <div v-else class="dict-grid">
          <router-link v-for="d in dicts" :key="d.id" :to="{ name: 'SourceViewer', params: { id: d.id } }" class="dict-card">
            <div class="dict-cover">{{ (d.name_zh || d.name).slice(0, 10) }}<br>{{ d.year }}</div>
            <div class="dict-info">
              <h3>{{ d.name }}</h3>
              <p>{{ d.description }}</p>
              <div class="dict-meta">
                <span class="dict-tag">{{ d.level || '—' }}</span>
                <span class="meta-text">{{ d.total_pages ? d.total_pages + ' 頁' : '—' }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
          <h2 style="margin-bottom:0">語料與文本</h2>
          <span class="meta-text">持續更新</span>
        </div>
        <div v-if="loading" style="color:var(--muted)">載入中…</div>
        <div v-else class="article-list">
          <router-link v-for="a in articles" :key="a.id" :to="{ name: 'ArticleReader', params: { id: a.id } }" class="article-row">
            <span class="article-date">{{ typeLabel(a.type) }}</span>
            <div>
              <span class="article-title">{{ a.name }}</span>
              <p class="article-desc">{{ a.description }}</p>
            </div>
            <span class="article-type">{{ typeLabel(a.type) }}</span>
          </router-link>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { sourcesApi } from '../../api/sources'
import type { Source } from '../../types/source'

const activeCat = ref(0)
const catTabs = ['全部', '字典原書', '語料文本', '教材']

const dicts = ref<Source[]>([])
const articles = ref<Source[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const all = await sourcesApi.getAll()
    dicts.value = all.filter(s => s.type === 'scan_dict')
    articles.value = all.filter(s => s.type === 'corpus' || s.type === 'text_dict' || s.type === 'wordlist')
  } catch (e) {
    console.error('Failed to load sources:', e)
  } finally {
    loading.value = false
  }
})

function typeLabel(type) {
  const map = { corpus: '語料', text_dict: '文本', wordlist: '教材' }
  return map[type] || type
}
</script>
