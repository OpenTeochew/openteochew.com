import { request } from './client'
import type { SearchResult, SearchParams } from '../types/search'

export const searchApi = {
  search(params: SearchParams): Promise<SearchResult> {
    return request<SearchResult>('/api/v1/search', params as Record<string, string | number | undefined>)
  }
}
