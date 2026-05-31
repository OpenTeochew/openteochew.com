import { request } from './client'
import type { EntryDetail } from '../types/entry'

export const entriesApi = {
  getById(id: number): Promise<EntryDetail> {
    return request<EntryDetail>(`/api/v1/entries/${id}`)
  }
}
