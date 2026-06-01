export interface Article {
  id: number
  source_id: number
  title: string
  content: string
  created_at: string
  updated_at: string
  source: { id: number; name: string; type: string } | null
}
