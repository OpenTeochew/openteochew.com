import { describe, it, expect } from 'vitest'
import { canTransition, toCsv, hashIp, signCookie, verifyCookie } from './suggestions'

describe('canTransition', () => {
  it('allows pending → accepted', () => {
    expect(canTransition('pending', 'accepted')).toBe(true)
  })
  it('allows pending → rejected', () => {
    expect(canTransition('pending', 'rejected')).toBe(true)
  })
  it('allows accepted → completed', () => {
    expect(canTransition('accepted', 'completed')).toBe(true)
  })
  it('allows accepted → rejected', () => {
    expect(canTransition('accepted', 'rejected')).toBe(true)
  })
  it('allows completed → accepted (undo)', () => {
    expect(canTransition('completed', 'accepted')).toBe(true)
  })
  it('allows rejected → pending (undo)', () => {
    expect(canTransition('rejected', 'pending')).toBe(true)
  })
  it('rejects pending → completed', () => {
    expect(canTransition('pending', 'completed')).toBe(false)
  })
  it('allows same-state (idempotent)', () => {
    expect(canTransition('pending', 'pending')).toBe(true)
  })
})

describe('toCsv', () => {
  const HEADERS = [
    'id', 'created_at', 'reviewed_at', 'status', 'category',
    'source_id', 'page_num', 'url', 'selected_text', 'user_note',
    'email', 'admin_note',
  ]

  it('starts with UTF-8 BOM', () => {
    const out = toCsv([], HEADERS)
    expect(out.charCodeAt(0)).toBe(0xfeff)
  })

  it('emits header row', () => {
    const out = toCsv([], HEADERS)
    expect(out.replace(/^\ufeff/, '').trim()).toBe(HEADERS.join(','))
  })

  it('escapes quotes and commas per RFC 4180', () => {
    const rows = [{
      id: 1, created_at: '2026-07-04', reviewed_at: null, status: 'accepted',
      category: 'text_revision', source_id: 1, page_num: 42,
      url: 'https://x/?a=1', selected_text: 'has "quote", comma',
      user_note: 'multi\nline', email: null, admin_note: null,
    }]
    const out = toCsv(rows, HEADERS)
    const body = out.replace(/^\ufeff/, '').split('\n').slice(1).join('\n')
    expect(body).toContain('"has ""quote"", comma"')
    expect(body).toContain('"multi\nline"')
  })

  it('renders null as empty', () => {
    const rows = [{
      id: 1, created_at: '2026-07-04', reviewed_at: null, status: 'accepted',
      category: 'feedback', source_id: null, page_num: null,
      url: '/x', selected_text: null, user_note: 'hi', email: null, admin_note: null,
    }]
    const out = toCsv(rows, HEADERS).replace(/^\ufeff/, '')
    const line = out.split('\n')[1]
    expect(line).toBe('1,2026-07-04,,accepted,feedback,,,/x,,hi,,')
  })
})

describe('hashIp', () => {
  it('produces stable 16-char hex', async () => {
    const a = await hashIp('1.2.3.4', 'salt')
    const b = await hashIp('1.2.3.4', 'salt')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
  })
  it('changes with salt', async () => {
    const a = await hashIp('1.2.3.4', 'saltA')
    const b = await hashIp('1.2.3.4', 'saltB')
    expect(a).not.toBe(b)
  })
})

describe('signCookie / verifyCookie', () => {
  const TOKEN = 'test-admin-token'
  it('round-trips a fresh cookie', async () => {
    const now = Date.now()
    const c = await signCookie(TOKEN, now)
    const v = await verifyCookie(TOKEN, c, now)
    expect(v).toBe(true)
  })
  it('rejects tampered cookie', async () => {
    const now = Date.now()
    const c = await signCookie(TOKEN, now)
    const tampered = c.slice(0, -2) + 'AA'
    const v = await verifyCookie(TOKEN, tampered, now)
    expect(v).toBe(false)
  })
  it('rejects expired cookie (> 30 days)', async () => {
    const past = Date.now() - 31 * 24 * 3600 * 1000
    const c = await signCookie(TOKEN, past)
    const v = await verifyCookie(TOKEN, c, Date.now())
    expect(v).toBe(false)
  })
  it('rejects malformed cookie', async () => {
    expect(await verifyCookie(TOKEN, 'not-a-cookie', Date.now())).toBe(false)
    expect(await verifyCookie(TOKEN, '', Date.now())).toBe(false)
  })
})
