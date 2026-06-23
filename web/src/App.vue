<template>
  <TopNav />
  <router-view />
  <footer class="pagefoot">
    <div class="container foot-inner">
      <div class="foot-left">
        <img class="foot-logo" src="/logo.jpg" alt="OpenTeochew" />
        <span class="foot-links">
          {{ locale.t2s('相輔') }}：<a href="https://github.com/OpenTeochew" target="_blank" rel="noopener">GitHub</a>
        </span>
        <span class="foot-links">
          {{ locale.t2s('聯絡') }}：<a href="mailto:contact@openteochew.com">contact@openteochew.com</a>
        </span>
        <span class="foot-links">
          {{ locale.t2s('長期支持單位/項目：') }}
        </span>
        <ul class="foot-support-list">
          <li>{{ locale.t2s('國家社會科學基金研究項目「近代域外潮州方言文獻所見詞彙系統及其歷史演變研究」（25BYY061）') }}</li>
        </ul>
        <span class="foot-links">
          <span>&copy; 2026 OpenTeochew · <router-link to="/license">{{ locale.t2s('版權聲明') }}</router-link> · <router-link to="/privacy">{{ locale.t2s('隱私條款') }}</router-link></span>
        </span>
      </div>
      <div class="foot-right">
        <div class="foot-stats">
          <div class="foot-stat">
            <span class="foot-stat-num">{{ totalEntries || '—' }}</span>
            <span class="foot-stat-label">{{ locale.t2s('收錄詞條') }}</span>
          </div>
          <div class="foot-stat">
            <span class="foot-stat-num">{{ sourceCount || '—' }}</span>
            <span class="foot-stat-label">{{ locale.t2s('資料來源') }}</span>
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
import { useLocaleStore } from './stores/locale'

const totalEntries = ref(0)
const sourceCount = ref(0)
const locale = useLocaleStore()

onMounted(async () => {
  locale.init()
  try {
    const sources = await sourcesApi.getAll()
    sourceCount.value = sources.length
    totalEntries.value = sources.reduce((sum, s) => sum + (s.total_entries || 0), 0)
  } catch (e) {}
})
</script>
