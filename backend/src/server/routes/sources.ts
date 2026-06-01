import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/sources', async (c) => {
  const type = c.req.query('type')
  let sql = 'SELECT * FROM sources'
  const params: any[] = []
  if (type) { sql += ' WHERE type = ?'; params.push(type) }
  sql += ' ORDER BY sort_order'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

routes.get('/sources/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const source = await c.env.DB.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first()
  if (!source) return c.json({ success: false, error: 'Source not found' }, 404)

  const sections = await c.env.DB.prepare(
    'SELECT * FROM sections WHERE source_id = ? ORDER BY sort_order'
  ).bind(id).all()

  return c.json({
    success: true,
    data: { ...source, sections: sections.results }
  })
})

routes.get('/sources/:id/entries', async (c) => {
  const sourceId = Number(c.req.param('id'))
  const sectionId = c.req.query('section_id')
  const pageNum = c.req.query('page_num')
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 50)

  let sql = 'SELECT * FROM entries WHERE source_id = ?'
  const params: any[] = [sourceId]

  if (sectionId) { sql += ' AND section_id = ?'; params.push(Number(sectionId)) }
  if (pageNum) { sql += ' AND page_num = ?'; params.push(Number(pageNum)) }

  sql += ' ORDER BY sort_order LIMIT ? OFFSET ?'
  params.push(limit, (page - 1) * limit)

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

routes.get('/sources/:id/pages', async (c) => {
  const sourceId = Number(c.req.param('id'))
  const pageNum = c.req.query('page_num')

  let sql = 'SELECT * FROM pages WHERE section_id IN (SELECT id FROM sections WHERE source_id = ?)'
  const params: any[] = [sourceId]

  if (pageNum) { sql += ' AND page_num = ?'; params.push(Number(pageNum)) }

  sql += ' ORDER BY page_num, sort_order'

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

export default routes
