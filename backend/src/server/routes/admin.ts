import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import {
  loginSchema,
  listQuerySchema,
  patchSuggestionSchema,
  exportQuerySchema,
} from '../schemas/suggestion'
import {
  signCookie,
  listSuggestions,
  getSuggestion,
  updateSuggestion,
  exportSuggestions,
  toCsv,
  canTransition,
} from '../services/suggestions'
import { adminAuth, COOKIE_NAME } from '../middleware/adminAuth'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

// --- login (no auth required) ---
routes.post('/admin/login', zValidator('json', loginSchema), async (c) => {
  const { token } = c.req.valid('json')
  if (token !== c.env.ADMIN_TOKEN) {
    return c.json({ success: false, error: 'invalid token' }, 401)
  }
  const cookie = await signCookie(c.env.ADMIN_TOKEN, Date.now())
  const isProd = c.req.header('Host')?.includes('openteochew.com')
  const attrs = [
    `${COOKIE_NAME}=${cookie}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=2592000',
  ]
  if (isProd) attrs.push('Secure')
  c.header('Set-Cookie', attrs.join('; '))
  return c.json({ success: true })
})

// --- everything else requires auth ---
routes.use('/admin/suggestions', adminAuth)
routes.use('/admin/suggestions/*', adminAuth)

routes.get('/admin/suggestions', zValidator('query', listQuerySchema), async (c) => {
  const q = c.req.valid('query')
  const { total, items } = await listSuggestions(c.env.DB, q)
  return c.json({ success: true, data: { total, page: q.page, items } })
})

routes.patch(
  '/admin/suggestions/:id',
  zValidator('json', patchSuggestionSchema),
  async (c) => {
    const id = Number(c.req.param('id'))
    const patch = c.req.valid('json')
    const row = await getSuggestion(c.env.DB, id)
    if (!row) return c.json({ success: false, error: 'not found' }, 404)
    if (!canTransition(row.status, patch.status)) {
      return c.json(
        { success: false, error: `illegal transition ${row.status} -> ${patch.status}` },
        400
      )
    }
    await updateSuggestion(c.env.DB, id, patch)
    return c.json({ success: true })
  }
)

routes.get(
  '/admin/suggestions/export.csv',
  zValidator('query', exportQuerySchema),
  async (c) => {
    const q = c.req.valid('query')
    const rows = await exportSuggestions(c.env.DB, q)
    const HEADERS = [
      'id', 'created_at', 'reviewed_at', 'status', 'category',
      'source_id', 'page_num', 'url', 'selected_text', 'user_note',
      'email', 'admin_note',
    ]
    const csv = toCsv(rows as unknown as Array<Record<string, unknown>>, HEADERS)

    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const parts: string[] = []
    if (q.status !== 'all') parts.push(q.status)
    if (q.category !== 'all') parts.push(q.category)
    if (q.source_id) parts.push(`src${q.source_id}`)
    const suffix = parts.length ? parts.join('_') + '_' : ''
    const filename = `suggestions_${suffix}${yyyymmdd}.csv`

    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)
    c.header('Cache-Control', 'no-store')
    return c.body(csv)
  }
)

export default routes
