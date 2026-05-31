import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import { searchSchema } from '../schemas/search'
import { searchEntries } from '../services/search'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/search', zValidator('query', searchSchema, (result, c) => {
  if (!result.success) return c.json({ success: false, error: result.error }, 400)
}), async (c) => {
  const params = c.req.valid('query')
  const data = await searchEntries(c.env.DB, params)
  return c.json({ success: true, data })
})

export default routes
