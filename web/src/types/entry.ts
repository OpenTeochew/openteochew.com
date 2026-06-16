export interface Entry {
  id: number
  source_id: number
  section_id: number | null
  han: string | null
  puj: string | null
  dp: string | null
  en: string | null
  mandarin: string | null
  ja: string | null
  han_orig: string | null
  puj_orig: string | null
  en_orig: string | null
  page_num: number | null
  sort_order: number
}

export interface EntryDetail extends Entry {
  source: SourceSummary
  examples: Example[]
}

export interface Example {
  id: number
  teochew: string
  puj: string | null
  translation: string | null
}

export interface SourceSummary {
  id: number
  name: string
  name_zh: string | null
  year: string | null
  original_fields: string | null
}
