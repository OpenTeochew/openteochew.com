import { z } from 'zod'

export const searchSchema = z.object({
  q_han: z.string().optional(),
  q_puj: z.string().optional(),
  q_dp: z.string().optional(),
  q_en: z.string().optional(),
  q_mandarin: z.string().optional(),
  q_ja: z.string().optional(),
  source_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
