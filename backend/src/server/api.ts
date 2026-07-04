import { Hono } from 'hono'
import type { CloudflareBindings } from './types/env'
import searchRoutes from './routes/search'
import entriesRoutes from './routes/entries'
import sourcesRoutes from './routes/sources'
import articlesRoutes from './routes/articles'
import suggestionsRoutes from './routes/suggestions'
import adminRoutes from './routes/admin'

const api = new Hono<{ Bindings: CloudflareBindings }>()

api.route('/', searchRoutes)
api.route('/', entriesRoutes)
api.route('/', sourcesRoutes)
api.route('/', articlesRoutes)
api.route('/', suggestionsRoutes)
api.route('/', adminRoutes)

export default api
