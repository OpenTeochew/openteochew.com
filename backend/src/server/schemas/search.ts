import { z } from 'zod'

export const searchSchema = z.object({
  q_hanzi: z.string().optional(),
  q_puj: z.string().optional(),
  q_dp: z.string().optional(),
  q_en: z.string().optional(),
  q_mandarin: z.string().optional(),
  q_ja: z.string().optional(),
  source_id: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})
