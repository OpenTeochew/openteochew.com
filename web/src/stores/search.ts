import { defineStore } from 'pinia'
import { ref } from 'vue'
import { searchApi } from '../api/search'
import type { SearchParams, SearchResult } from '../types/search'

export const useSearchStore = defineStore('search', () => {
  const params = ref<SearchParams>({})
  const result = ref<SearchResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function search(newParams?: SearchParams) {
    if (newParams) params.value = newParams
    loading.value = true
    error.value = null
    try {
      result.value = await searchApi.search(params.value)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    params.value = {}
    result.value = null
    error.value = null
  }

  return { params, result, loading, error, search, reset }
})
