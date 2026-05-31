import { useRouter } from 'vue-router'
import { useSearchStore } from '../stores/search'
import type { SearchParams } from '../types/search'

export function useSearch() {
  const router = useRouter()
  const store = useSearchStore()

  function buildParams(rows: { field: string; value: string }[]): SearchParams {
    const params: SearchParams = {}
    for (const row of rows) {
      if (!row.value.trim()) continue
      const key = `q_${row.field}` as keyof SearchParams
      ;(params as any)[key] = row.value.trim()
    }
    return params
  }

  async function doSearch(rows: { field: string; value: string }[]) {
    const params = buildParams(rows)
    await store.search(params)
    router.push({ name: 'SearchResults' })
  }

  return { store, buildParams, doSearch }
}
