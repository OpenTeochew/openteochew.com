import { z } from 'zod'

export const CATEGORIES = ['text_revision', 'data_contribution', 'feedback'] as const
export const STATUSES = ['pending', 'accepted', 'rejected', 'completed'] as const

export type Category = typeof CATEGORIES[number]
export type Status = typeof STATUSES[number]

export const submitSuggestionSchema = z
  .object({
    category: z.enum(CATEGORIES),
    source_id: z.coerce.number().int().positive().optional(),
    page_num: z.coerce.number().int().positive().optional(),
    url: z.string().min(1).max(2000),
    selected_text: z.string().max(500).optional(),
    user_note: z.string().max(500).optional(),
    email: z
      .string()
      .max(254)
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine(
    (d) =>
      (d.selected_text && d.selected_text.trim().length > 0) ||
      (d.user_note && d.user_note.trim().length > 0),
    { message: 'selected_text 與 user_note 至少一個非空' }
  )

export type SubmitSuggestionInput = z.infer<typeof submitSuggestionSchema>

export const patchSuggestionSchema = z.object({
  status: z.enum(STATUSES),
  admin_note: z.string().max(2000).optional(),
})

export const listQuerySchema = z.object({
  status: z.enum([...STATUSES, 'all'] as const).default('pending'),
  category: z.enum([...CATEGORIES, 'all'] as const).default('all'),
  source_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const exportQuerySchema = z.object({
  source_id: z.coerce.number().int().positive().optional(),
  include_completed: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
})

export const loginSchema = z.object({
  token: z.string().min(1).max(512),
})
