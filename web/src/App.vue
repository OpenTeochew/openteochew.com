<template>
  <TopNav />
  <router-view />
  <footer class="pagefoot">
    <div class="container foot-inner">
      <div class="foot-left">
        <span>&copy; 2026 OpenTeochew · CC0 數據 · MIT 代碼</span>
        <span class="foot-links">
          <a href="https://github.com/OpenTeochew" target="_blank" rel="noopener">GitHub</a>
          <a href="mailto:hi@openteochew.com">hi@openteochew.com</a>
        </span>
      </div>
      <div class="foot-right">
        <div class="foot-stats">
          <div class="foot-stat">
            <span class="foot-stat-num">—</span>
            <span class="foot-stat-label">收錄詞條</span>
          </div>
          <div class="foot-stat">
            <span class="foot-stat-num">—</span>
            <span class="foot-stat-label">資料來源</span>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import TopNav from './components/TopNav.vue'
</script>
