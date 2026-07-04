import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import { submitSuggestionSchema } from '../schemas/suggestion'
import { insertSuggestion, hashIp } from '../services/suggestions'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.post('/suggestions', zValidator('json', submitSuggestionSchema), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const ua = (c.req.header('User-Agent') || '').slice(0, 200)
  const ipHash = await hashIp(ip, c.env.WORKER_SALT)

  const id = await insertSuggestion(c.env.DB, {
    category: body.category,
    source_id: body.source_id,
    page_num: body.page_num,
    url: body.url,
    selected_text: body.selected_text,
    user_note: body.user_note,
    email: body.email,
    ip_hash: ipHash,
    user_agent: ua,
  })

  return c.json({ success: true, data: { id } })
})

export default routes
