import { Hono } from 'hono'
import type { CloudflareBindings } from './types/env'
import searchRoutes from './routes/search'
import entriesRoutes from './routes/entries'
import sourcesRoutes from './routes/sources'
import articlesRoutes from './routes/articles'

const api = new Hono<{ Bindings: CloudflareBindings }>()

api.use('*', async (c, next) => {
  await next()
  if (c.req.path.startsWith('/api/')) {
    c.header('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  }
})

api.route('/', searchRoutes)
api.route('/', entriesRoutes)
api.route('/', sourcesRoutes)
api.route('/', articlesRoutes)

export default api
