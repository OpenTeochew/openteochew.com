<template>
  <header class="topnav">
    <div class="container nav-inner">
      <router-link to="/" class="logo">
        <span class="logo-main">OpenTeochew<span class="beta-badge">BETA</span></span>
        <span class="logo-sub">潮州話資料庫</span>
      </router-link>
      <nav class="nav-tabs">
        <router-link to="/" class="nav-tab" :class="{ active: isChheActive }">Chhê 查</router-link>
        <router-link to="/thak" class="nav-tab" :class="{ active: isThakActive }">Tha̍k 讀</router-link>
        <router-link to="/about" class="nav-tab" :class="{ active: isAboutActive }">關於</router-link>
      </nav>
      <button class="lang-btn" aria-label="切換語言">中 ▾</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isChheActive = computed(() => route.path === '/' || route.path.startsWith('/chhe'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
const isAboutActive = computed(() => route.path === '/about')
</script>
