<template>
  <span v-if="orig" class="orig">({{ orig }})</span>
</template>

<script setup>
defineProps({ orig: { type: String, default: '' } })
</script>
