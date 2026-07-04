import type { Status } from '../schemas/suggestion'

const COOKIE_TTL_MS = 30 * 24 * 3600 * 1000

const ALLOWED_TRANSITIONS: Record<Status, Set<Status>> = {
  pending: new Set(['pending', 'accepted', 'rejected']),
  accepted: new Set(['accepted', 'completed', 'rejected']),
  rejected: new Set(['rejected', 'pending']),
  completed: new Set(['completed', 'accepted']),
}

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines: string[] = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  }
  return '\ufeff' + lines.join('\n') + '\n'
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const hex = await sha256Hex(ip + salt)
  return hex.slice(0, 16)
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(token: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return new Uint8Array(sig)
}

export async function signCookie(token: string, timestamp: number): Promise<string> {
  const ts = String(timestamp)
  const tsB64 = b64urlEncode(new TextEncoder().encode(ts))
  const sig = await hmac(token, ts)
  return `${tsB64}.${b64urlEncode(sig)}`
}

function constantTimeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyCookie(token: string, cookie: string, nowMs: number): Promise<boolean> {
  if (!cookie || typeof cookie !== 'string') return false
  const parts = cookie.split('.')
  if (parts.length !== 2) return false
  try {
    const tsBytes = b64urlDecode(parts[0])
    const ts = Number(new TextDecoder().decode(tsBytes))
    if (!Number.isFinite(ts)) return false
    if (nowMs - ts > COOKIE_TTL_MS || ts > nowMs + 60_000) return false
    const gotSig = b64urlDecode(parts[1])
    const wantSig = await hmac(token, String(ts))
    return constantTimeEq(gotSig, wantSig)
  } catch {
    return false
  }
}
