import { Hono } from 'hono'
import { cache } from 'hono/cache'
import api from './server/api'
import type { CloudflareBindings } from './server/types/env'

const app = new Hono<{ Bindings: CloudflareBindings }>()

const CACHE_RULES: [RegExp, number][] = [
  [/^\/api\/v1\/search/, 600],
  [/^\/api\/v1\/sources\/\d+\/entries/, 600],
  [/^\/api\/v1\/sources\/\d+\/pages/, 1800],
  [/^\/api\/v1\/entries\/\d+/, 600],
  [/^\/api\/v1\/articles\/\d+/, 1800],
  [/^\/api\/v1\/sources(\/\d+)?\/?$/, 3600],
]

function getCacheControl(path: string): string | null {
  for (const [re, ttl] of CACHE_RULES) {
    if (re.test(path)) return `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}`
  }
  return null
}

app.use('/api/v1/*', async (c, next) => {
  const cc = getCacheControl(c.req.path)
  if (cc) {
    const cacheMiddleware = cache({ cacheName: 'api-v1', cacheControl: cc })
    return cacheMiddleware(c, next)
  }
  return next()
})

app.route('/api/v1', api)

app.get('*', async (c) => {
  try {
    if (c.env?.ASSETS) {
      const assetResponse = await c.env.ASSETS.fetch(
        new Request(c.req.url, c.req.raw)
      )
      if (assetResponse && assetResponse.status !== 404) {
        return new Response(assetResponse.body, assetResponse)
      }
    }
    if (c.env?.ASSETS) {
      const indexPath = new URL('/index.html', c.req.url).href
      const indexResponse = await c.env.ASSETS.fetch(new Request(indexPath))
      if (indexResponse) {
        return new Response(indexResponse.body, indexResponse)
      }
    }
    return c.notFound()
  } catch {
    return c.notFound()
  }
})

export default app
