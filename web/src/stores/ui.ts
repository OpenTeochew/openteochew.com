import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const activeSourceFilter = ref<number | null>(null)

  function setSourceFilter(id: number | null) {
    activeSourceFilter.value = id
  }

  return { activeSourceFilter, setSourceFilter }
})
