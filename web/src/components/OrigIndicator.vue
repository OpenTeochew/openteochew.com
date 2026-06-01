<template>
  <span v-if="orig" class="orig-wrap">
    <span class="orig-mark" @mouseenter="show = true" @mouseleave="show = false" @click="show = !show">&#9998;</span>
    <span v-if="show" class="orig-tooltip">&#21476;&#65306;{{ orig }}</span>
  </span>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ orig: { type: String, default: '' } })
const show = ref(false)
</script>
