<template>
  <TopNav />
  <router-view />
  <footer class="pagefoot">
    <div class="container foot-inner">
      <div class="foot-left">
        <span>&copy; 2026 OpenTeochew · CC0 數據 · MIT 代碼</span>
        <span class="foot-links">
          <a href="https://github.com/OpenTeochew" target="_blank" rel="noopener">GitHub</a>
          <a href="mailto:contact@openteochew.com">contact@openteochew.com</a>
        </span>
      </div>
      <div class="foot-right">
        <div class="foot-stats">
          <div class="foot-stat">
            <span class="foot-stat-num">{{ totalEntries || '—' }}</span>
            <span class="foot-stat-label">收錄詞條</span>
          </div>
          <div class="foot-stat">
            <span class="foot-stat-num">{{ sourceCount || '—' }}</span>
            <span class="foot-stat-label">資料來源</span>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TopNav from './components/TopNav.vue'
import { sourcesApi } from './api/sources'

const totalEntries = ref(0)
const sourceCount = ref(0)

onMounted(async () => {
  try {
    const sources = await sourcesApi.getAll()
    sourceCount.value = sources.length
    totalEntries.value = sources.reduce((sum, s) => sum + (s.total_entries || 0), 0)
  } catch (e) {}
})
</script>
