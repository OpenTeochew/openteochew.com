import { request } from './client'
import type { Article } from '../types/article'

export const articlesApi = {
  getById(id: number): Promise<Article> {
    return request<Article>(`/api/v1/articles/${id}`)
  }
}
