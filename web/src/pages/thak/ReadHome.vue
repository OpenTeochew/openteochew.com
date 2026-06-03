<template>
  <main>
    <section class="section thak-hero">
      <div class="container" style="max-width: 680px;">
        <h1>讀潮州話</h1>
        <p class="lead">瀏覽潮州話辭書與教材，所有資料標明出處，開放使用。</p>
        <div class="cat-tabs">
          <button v-for="(t, i) in catTabs" :key="t.key" class="cat-tab" :class="{ active: activeCat === i }" @click="activeCat = i">{{ t.label }}</button>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div v-if="loading" style="color:var(--muted)">載入中…</div>
        <div v-else class="dict-grid">
          <router-link v-for="s in filtered" :key="s.id" :to="{ name: 'SourceViewer', params: { id: s.id } }" class="dict-card">
            <div class="dict-cover">{{ s.year }}<br>{{ (s.name_zh || s.name).slice(0, 4) }}</div>
            <div class="dict-info">
              <h3>{{ s.year }}·{{ s.name_zh || s.name }}</h3>
              <p class="meta-text">{{ s.name }}</p>
              <p class="meta-text">{{ s.author }}</p>
              <div class="dict-meta">
                <span class="dict-tag">{{ typeLabel(s.type) }}</span>
                <span class="meta-text">{{ s.total_entries ? s.total_entries.toLocaleString() + ' 詞條' : '' }}</span>
                <span class="meta-text">{{ s.total_pages ? s.total_pages + ' 頁' : '' }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { sourcesApi } from '../../api/sources'

const activeCat = ref(0)
const catTabs = [
  { key: 'all', label: '全部' },
  { key: 'dictionary', label: '辭書' },
  { key: 'textbook', label: '教材' },
]

const sources = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    sources.value = await sourcesApi.getAll()
  } catch (e) {
    console.error('Failed to load sources:', e)
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const key = catTabs[activeCat.value].key
  if (key === 'all') return sources.value
  return sources.value.filter(s => s.type === key)
})

function typeLabel(type) {
  const map = { dictionary: '辭書', textbook: '教材' }
  return map[type] || type
}
</script>
