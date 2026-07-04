<template>
  <header class="topnav">
    <div class="container nav-inner">
      <router-link to="/" class="logo">
        <span class="logo-main">OpenTeochew<span class="beta-badge">BETA</span></span>
        <span class="logo-sub">{{ locale.t2s('潮州話開放資料庫') }}</span>
      </router-link>
      <nav class="nav-tabs">
        <router-link to="/" class="nav-tab" :class="{ active: isChheActive }">Chhê <span class="nav-tab-cn">{{ locale.t2s('查') }}</span></router-link>
        <router-link to="/thak" class="nav-tab" :class="{ active: isThakActive }">Tha̍k <span class="nav-tab-cn">{{ locale.t2s('讀') }}</span></router-link>
        <router-link to="/suggest" class="nav-tab" :class="{ active: isSuggestActive }">{{ locale.t2s('反饋') }}</router-link>
        <router-link to="/about" class="nav-tab" :class="{ active: isAboutActive }">{{ locale.t2s('關於') }}</router-link>
      </nav>
      <button class="lang-toggle" :class="{ active: locale.simplified }" @click="locale.toggle()" aria-label="切换简体">
        <span class="lang-toggle-label">简</span>
        <span class="lang-toggle-track"><span class="lang-toggle-thumb"></span></span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const locale = useLocaleStore()

const isChheActive = computed(() => route.path === '/' || route.path.startsWith('/chhe'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
const isAboutActive = computed(() => route.path === '/about')
const isSuggestActive = computed(() => route.path === '/suggest')
</script>
