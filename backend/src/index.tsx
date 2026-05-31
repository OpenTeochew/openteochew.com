import { Hono } from 'hono'
import api from './server/api'
import type { CloudflareBindings } from './server/types/env'

const app = new Hono<{ Bindings: CloudflareBindings }>()

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
