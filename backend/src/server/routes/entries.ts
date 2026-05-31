import { Hono } from 'hono'
import type { CloudflareBindings } from '../types/env'
import { getEntryById } from '../services/entries'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.get('/entries/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const data = await getEntryById(c.env.DB, id)
  if (!data) return c.json({ success: false, error: 'Entry not found' }, 404)
  return c.json({ success: true, data })
})

export default routes
