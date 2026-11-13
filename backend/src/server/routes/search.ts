import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import { searchSchema } from '../schemas/search'
import { searchEntries } from '../services/search'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/search', zValidator('query', searchSchema, (result, c) => {
  if (!result.success) return c.json({ success: false, error: result.error }, 400)
}), async (c) => {
  try {
    const params = c.req.valid('query')
    const data = await searchEntries(c.env.DB, params)
    return c.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("exceeded D1's free tier daily row read limit")) {
      return c.json({
        success: false,
        error: '資料庫今日的免費讀取額度已用完，請於每日 UTC 00:00（台灣時間上午 8:00）重置後再試。',
      }, 503)
    }
    throw error
  }
})

export default routes
