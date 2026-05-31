export interface Entry {
  id: number
  source_id: number
  section_id: number | null
  hanzi: string | null
  puj: string | null
  dp: string | null
  en: string | null
  mandarin: string | null
  ja: string | null
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
  year: string | null
}
