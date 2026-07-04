import type { MiddlewareHandler } from 'hono'
import type { CloudflareBindings } from '../types/env'
import { verifyCookie } from '../services/suggestions'

export const COOKIE_NAME = 'admin_session'

export function parseCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

export const adminAuth: MiddlewareHandler<{ Bindings: CloudflareBindings }> = async (c, next) => {
  const cookie = parseCookie(c.req.header('Cookie'), COOKIE_NAME)
  if (!cookie) return c.json({ success: false, error: 'unauthorized' }, 401)
  const ok = await verifyCookie(c.env.ADMIN_TOKEN, cookie, Date.now())
  if (!ok) return c.json({ success: false, error: 'unauthorized' }, 401)
  await next()
}
