<template>
  <header class="topnav">
    <div class="container nav-inner">
      <router-link to="/" class="logo">OpenTeochew</router-link>
      <nav class="nav-tabs">
        <router-link to="/chhe" class="nav-tab" :class="{ active: isChheActive }">Chhe 查</router-link>
        <router-link to="/thak" class="nav-tab" :class="{ active: isThakActive }">Thak 讀</router-link>
      </nav>
      <button class="lang-btn" aria-label="切換語言">中 ▾</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isChheActive = computed(() => route.path.startsWith('/chhe'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
</script>
