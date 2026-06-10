export interface Source {
  id: number
  name: string
  name_zh: string | null
  author: string | null
  year: string | null
  type: 'dictionary' | 'textbook'
  level: string | null
  status: string | null
  description: string | null
  cover_url: string | null
  total_entries: number
  total_pages: number
  sort_order: number
}

export interface SourceDetail extends Source {
  sections?: Section[]
}

export interface Section {
  id: number
  source_id: number
  title: string
  sort_order: number
}

export interface Page {
  id: number
  section_id: number
  page_num: number
  image_url: string | null
  ocr_text: string | null
  sort_order: number
}
