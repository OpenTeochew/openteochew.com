export interface SuggestionInput {
  category: 'text_revision' | 'data_contribution' | 'feedback'
  source_id?: number
  page_num?: number
  url: string
  selected_text?: string
  user_note?: string
  email?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return json.data as T
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return (json.data ?? {}) as T
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return json.data as T
}

export const suggestionsApi = {
  submit(input: SuggestionInput) {
    return post<{ id: number }>('/api/v1/suggestions', input)
  },
}

export const adminApi = {
  login(token: string) {
    return post<Record<string, never>>('/api/v1/admin/login', { token })
  },
  list(params: Record<string, string | number | undefined>) {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v))
    })
    return getJson<{ total: number; page: number; items: Array<Record<string, unknown>> }>(
      `/api/v1/admin/suggestions?${q.toString()}`
    )
  },
  patch(id: number, body: { status: string; admin_note?: string }) {
    return patchJson<Record<string, never>>(`/api/v1/admin/suggestions/${id}`, body)
  },
  exportUrl(source_id?: number, include_completed = false): string {
    const q = new URLSearchParams()
    if (source_id) q.set('source_id', String(source_id))
    if (include_completed) q.set('include_completed', 'true')
    return `/api/v1/admin/suggestions/export.csv?${q.toString()}`
  },
}
