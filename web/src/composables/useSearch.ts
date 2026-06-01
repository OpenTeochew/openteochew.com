import { useRouter } from 'vue-router'
import { useSearchStore } from '../stores/search'
import type { SearchParams } from '../types/search'

const FIELD_MAP: Record<string, string> = {
  puj: 'puj',
  dp: 'dp',
  hanzi: 'han',
  en: 'en',
  zh: 'mandarin',
  ja: 'ja'
}

export function useSearch() {
  const router = useRouter()
  const store = useSearchStore()

  function buildParams(rows: { field: string; value: string }[]): SearchParams {
    const params: SearchParams = {}
    for (const row of rows) {
      if (!row.value.trim()) continue
      const mappedField = FIELD_MAP[row.field] || row.field
      const key = `q_${mappedField}` as keyof SearchParams
      ;(params as any)[key] = row.value.trim()
    }
    return params
  }

  async function doSearch(rows: { field: string; value: string }[]) {
    const params = buildParams(rows)
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(params)) {
      if (v) query[k] = String(v)
    }
    await store.search(params)
    router.push({ name: 'SearchResults', query })
  }

  return { store, buildParams, doSearch }
}
