<template>
  <main>
    <section class="section thak-hero">
      <div class="container" style="max-width: 680px;">
        <h1>{{ t2s('讀潮州話') }}</h1>
        <p class="lead">{{ t2s('瀏覽潮州話辭書、教材與經文，所有資料標明出處，開放使用。') }}</p>
        <div class="cat-tabs">
          <button v-for="(t, i) in catTabs" :key="t.key" class="cat-tab" :class="{ active: activeCat === i }" @click="activeCat = i">{{ t.label }}</button>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div v-if="loading" style="color:var(--muted)">{{ t2s('載入中…') }}</div>
        <div v-else class="dict-grid">
          <router-link v-for="s in filtered" :key="s.id" :to="{ name: 'SourceViewer', params: { id: s.id } }" class="dict-card">
            <div v-if="s.cover_url" class="dict-cover"><img :src="s.cover_url" :alt="s.name_zh || s.name" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);" /></div>
            <div class="dict-info">
              <h3>{{ s.year }}·{{ s.name_zh ? `《${t2s(s.name_zh)}》` : s.name }}</h3>
              <p class="dict-name-en">{{ s.name }}</p>
              <p class="meta-text">{{ s.author }}</p>
              <div class="dict-meta">
                <span class="dict-tag">{{ typeLabel(s.type) }}</span>
                <span v-if="s.total_entries" class="meta-text">{{ s.total_entries.toLocaleString() }} {{ t2s('詞條') }}</span>
                <span v-else class="source-pending">{{ t2s('收錄中') }}</span>
                <span class="meta-text">{{ s.total_pages ? s.total_pages + ' ' + t2s('頁') : '' }}</span>
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
import { useSimplified } from '../../composables/useSimplified'

const { simplified, t2s } = useSimplified()

const activeCat = ref(0)
const catTabs = computed(() => [
  { key: 'all', label: t2s('全部') },
  { key: 'dictionary', label: t2s('辭書') },
  { key: 'textbook', label: t2s('教材') },
  { key: 'scripture', label: t2s('經文') },
])

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
  const key = catTabs.value[activeCat.value].key
  if (key === 'all') return sources.value
  return sources.value.filter(s => s.type === key)
})

function typeLabel(type) {
  const map = { dictionary: t2s('辭書'), textbook: t2s('教材'), scripture: t2s('經文') }
  return map[type] || type
}
</script>
