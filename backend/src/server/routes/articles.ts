import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/articles/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const article = await c.env.DB.prepare(
    'SELECT * FROM articles WHERE id = ?'
  ).bind(id).first()
  if (!article) return c.json({ success: false, error: 'Article not found' }, 404)

  const source = await c.env.DB.prepare(
    'SELECT id, name, type FROM sources WHERE id = ?'
  ).bind((article as any).source_id).first()

  return c.json({
    success: true,
    data: { ...article, source }
  })
})

export default routes
