import { request } from './client'
import type { Source, SourceDetail, Page } from '../types/source'
import type { Entry } from '../types/entry'

export const sourcesApi = {
  getAll(type?: string): Promise<Source[]> {
    return request<Source[]>('/api/v1/sources', type ? { type } : undefined)
  },
  getById(id: number): Promise<SourceDetail> {
    return request<SourceDetail>(`/api/v1/sources/${id}`)
  },
  getEntries(sourceId: number, params?: Record<string, string | number | undefined>): Promise<Entry[]> {
    return request<Entry[]>(`/api/v1/sources/${sourceId}/entries`, params)
  },
  getPages(sourceId: number, params?: Record<string, string | number | undefined>): Promise<Page[]> {
    return request<Page[]>(`/api/v1/sources/${sourceId}/pages`, params)
  }
}
