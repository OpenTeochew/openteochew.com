import type { Entry } from './entry'
import type { SourceSummary } from './source'

export interface SearchParams {
  q_han?: string
  q_puj?: string
  q_dp?: string
  q_en?: string
  q_mandarin?: string
  q_ja?: string
  source_id?: number
  page?: number
  limit?: number
}

export interface SearchGroup {
  source: SourceSummary
  count: number
  entries: Entry[]
}

export interface SearchMatchMeta {
  mode: 'direct' | 'mandarin_bridge'
  bridge_terms?: string[]
}

export interface SearchResult {
  total: number
  page: number
  groups: SearchGroup[]
  match_meta?: SearchMatchMeta
}
