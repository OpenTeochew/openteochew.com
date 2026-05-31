<template>
  <TopNav />
  <router-view />
  <footer class="pagefoot">
    <div class="container foot-inner">
      <span>&copy; 2026 OpenTeochew</span>
      <span>CC0 數據 · MIT 代碼</span>
      <span><a href="https://github.com/OpenTeochew" target="_blank" rel="noopener">GitHub</a></span>
      <span><a href="mailto:hi@openteochew.com">hi@openteochew.com</a></span>
    </div>
  </footer>
</template>

<script setup>
import TopNav from './components/TopNav.vue'
</script>
