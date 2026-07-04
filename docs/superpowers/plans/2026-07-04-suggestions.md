# Suggestions 收集系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 openteochew.com 訪客能在 SourceViewer 劃選 OCR 文字提交修訂建議、或透過獨立反饋頁提交主題建議；admin 後台審核、標記完成、匯出 CSV。

**Architecture:** 新增一張 D1 表 `suggestions`（四狀態機：pending / accepted / rejected / completed）。後端 Hono 加兩組路由：訪客 `POST /api/v1/suggestions`（無認證），admin `/api/v1/admin/*`（HMAC cookie 認證，token 存 `env.ADMIN_TOKEN` secret）。前端新增 3 個路由（`/suggest`、`/admin`、`/admin/suggestions`）+ 3 個組件（`SelectionPopover`、`SuggestModal`、`SuggestForm`）+ 3 個頁面。CSV 匯出預設排除 `completed`，手動點「完成」由 admin 標記。dataset repo 資料流保持單向不變。

**Tech Stack:** Hono + zod + @hono/zod-validator + D1；Vue 3 `<script setup>` + Pinia + vue-router (hash mode) + kami CSS tokens；vitest for backend tests。

**Reference:** `docs/superpowers/specs/2026-07-04-suggestions-design.md`

---

## File Structure

**Backend（新增）：**

```
backend/src/server/
├── routes/
│   ├── suggestions.ts    (POST /suggestions)
│   └── admin.ts          (login + list + patch + export)
├── schemas/
│   └── suggestion.ts     (Zod validators)
├── services/
│   ├── suggestions.ts    (D1 CRUD, state machine, CSV serializer, HMAC)
│   └── suggestions.test.ts
├── middleware/
│   ├── adminAuth.ts      (verify HMAC cookie)
│   └── adminAuth.test.ts
```

**Backend（修改）：**

- `backend/src/server/types/env.ts` — 加 `ADMIN_TOKEN`、`WORKER_SALT` 欄位
- `backend/src/server/api.ts` — 掛新路由

**Frontend（新增）：**

```
web/src/
├── api/
│   └── suggestions.ts    (public + admin API client)
├── components/
│   ├── SelectionPopover.vue
│   ├── SuggestForm.vue    (共享表單, modal 與 inline 均使用)
│   └── SuggestModal.vue   (wraps SuggestForm)
├── pages/
│   ├── SuggestPage.vue    (獨立反饋頁 /suggest)
│   └── admin/
│       ├── AdminLogin.vue      (/admin)
│       └── SuggestionsAdmin.vue (/admin/suggestions)
```

**Frontend（修改）：**

- `web/src/router/index.js` — 加 3 個路由
- `web/src/pages/thak/SourceViewer.vue` — 掛 popover + modal
- `web/src/styles/tokens.css` — 加 modal / popover / admin 樣式類

**其他：**

- `scripts/008_suggestions.sql` — migration
- `web/public/robots.txt` — 加 `Disallow: /admin`
- `backend/.dev.vars` — 本地 secrets（gitignored）

---

## Task 1: Database Migration

**Files:**
- Create: `scripts/008_suggestions.sql`

- [ ] **Step 1: Write migration SQL**

Create `scripts/008_suggestions.sql`:

```sql
-- Migration 008: suggestions table for visitor-submitted OCR revisions and feedback.
-- See docs/superpowers/specs/2026-07-04-suggestions-design.md

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  source_id INTEGER,
  page_num INTEGER,
  url TEXT,
  selected_text TEXT,
  user_note TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_source ON suggestions(source_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at DESC);
```

- [ ] **Step 2: Apply to local dev DB**

Run: `sqlite3 tmp/openteochew.db < scripts/008_suggestions.sql`

Expected: no output, exit 0.

Verify:

```bash
sqlite3 tmp/openteochew.db ".schema suggestions"
```

Expected: schema printed matching the migration.

- [ ] **Step 3: Commit**

```bash
git add scripts/008_suggestions.sql
git commit -m "feat(sugg): add suggestions table migration"
```

---

## Task 2: Env Types & Local Secrets

**Files:**
- Modify: `backend/src/server/types/env.ts`
- Create: `backend/.dev.vars` (NOT committed)
- Modify: `.gitignore` if `.dev.vars` not yet ignored

- [ ] **Step 1: Add secret fields to CloudflareBindings**

Replace `backend/src/server/types/env.ts` with:

```typescript
export interface CloudflareBindings {
  DB: D1Database
  ASSETS: any
  ADMIN_TOKEN: string
  WORKER_SALT: string
}
```

- [ ] **Step 2: Ensure .dev.vars is gitignored**

Check root `.gitignore`:

```bash
grep -n "\.dev\.vars" .gitignore || echo "MISSING"
```

If MISSING, append to root `.gitignore`:

```
.dev.vars
backend/.dev.vars
```

- [ ] **Step 3: Create local dev secrets**

Create `backend/.dev.vars` (do NOT commit):

```
ADMIN_TOKEN=dev-admin-token-change-me
WORKER_SALT=dev-salt-change-me
```

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/server/types/env.ts .gitignore
git commit -m "feat(sugg): add ADMIN_TOKEN and WORKER_SALT bindings"
```

---

## Task 3: Zod Schemas

**Files:**
- Create: `backend/src/server/schemas/suggestion.ts`

- [ ] **Step 1: Write Zod schemas**

Create `backend/src/server/schemas/suggestion.ts`:

```typescript
import { z } from 'zod'

export const CATEGORIES = ['text_revision', 'data_contribution', 'feedback'] as const
export const STATUSES = ['pending', 'accepted', 'rejected', 'completed'] as const

export type Category = typeof CATEGORIES[number]
export type Status = typeof STATUSES[number]

export const submitSuggestionSchema = z
  .object({
    category: z.enum(CATEGORIES),
    source_id: z.coerce.number().int().positive().optional(),
    page_num: z.coerce.number().int().positive().optional(),
    url: z.string().min(1).max(2000),
    selected_text: z.string().max(500).optional(),
    user_note: z.string().max(500).optional(),
    email: z
      .string()
      .max(254)
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine(
    (d) =>
      (d.selected_text && d.selected_text.trim().length > 0) ||
      (d.user_note && d.user_note.trim().length > 0),
    { message: 'selected_text 與 user_note 至少一個非空' }
  )

export type SubmitSuggestionInput = z.infer<typeof submitSuggestionSchema>

export const patchSuggestionSchema = z.object({
  status: z.enum(STATUSES),
  admin_note: z.string().max(2000).optional(),
})

export const listQuerySchema = z.object({
  status: z.enum([...STATUSES, 'all'] as const).default('pending'),
  category: z.enum([...CATEGORIES, 'all'] as const).default('all'),
  source_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const exportQuerySchema = z.object({
  source_id: z.coerce.number().int().positive().optional(),
  include_completed: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
})

export const loginSchema = z.object({
  token: z.string().min(1).max(512),
})
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server/schemas/suggestion.ts
git commit -m "feat(sugg): add zod schemas for suggestions"
```

---

## Task 4: Suggestions Service — pure helpers (TDD)

Split into pure helpers first (state-machine + CSV + HMAC + hash). D1 CRUD goes in Task 5.

**Files:**
- Create: `backend/src/server/services/suggestions.ts`
- Create: `backend/src/server/services/suggestions.test.ts`

- [ ] **Step 1: Write the failing tests for state-machine + CSV**

Create `backend/src/server/services/suggestions.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/server/services/suggestions.test.ts`

Expected: FAIL — file `./suggestions` not found or exports missing.

- [ ] **Step 3: Implement service helpers**

Create `backend/src/server/services/suggestions.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/server/services/suggestions.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/server/services/suggestions.ts backend/src/server/services/suggestions.test.ts
git commit -m "feat(sugg): add state-machine + CSV + HMAC helpers with tests"
```

---

## Task 5: D1 CRUD functions

**Files:**
- Modify: `backend/src/server/services/suggestions.ts` (append)

- [ ] **Step 1: Append CRUD functions to service**

Append to `backend/src/server/services/suggestions.ts`. Note: the file already imports `Status` at the top from Task 4. Add `Category` to that existing import line, then append the rest at the bottom.

Change the top import line from:

```typescript
import type { Status } from '../schemas/suggestion'
```

to:

```typescript
import type { Category, Status } from '../schemas/suggestion'
```

Then append at the end of the file:

```typescript
// -------- D1 CRUD --------

export interface SuggestionRow {
  id: number
  category: Category
  source_id: number | null
  page_num: number | null
  url: string | null
  selected_text: string | null
  user_note: string | null
  email: string | null
  status: Status
  admin_note: string | null
  ip_hash: string | null
  user_agent: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface InsertInput {
  category: Category
  source_id?: number
  page_num?: number
  url: string
  selected_text?: string
  user_note?: string
  email?: string
  ip_hash?: string
  user_agent?: string
}

export async function insertSuggestion(db: D1Database, input: InsertInput): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO suggestions
       (category, source_id, page_num, url, selected_text, user_note, email, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.category,
      input.source_id ?? null,
      input.page_num ?? null,
      input.url,
      input.selected_text ?? null,
      input.user_note ?? null,
      input.email ?? null,
      input.ip_hash ?? null,
      input.user_agent ?? null
    )
    .run()
  return Number(res.meta.last_row_id)
}

export interface ListParams {
  status: Status | 'all'
  category: Category | 'all'
  source_id?: number
  page: number
  limit: number
}

export async function listSuggestions(
  db: D1Database,
  p: ListParams
): Promise<{ total: number; items: SuggestionRow[] }> {
  const where: string[] = []
  const args: unknown[] = []
  if (p.status !== 'all') { where.push('status = ?'); args.push(p.status) }
  if (p.category !== 'all') { where.push('category = ?'); args.push(p.category) }
  if (p.source_id !== undefined) { where.push('source_id = ?'); args.push(p.source_id) }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const countRow = await db
    .prepare(`SELECT COUNT(*) as c FROM suggestions ${whereSql}`)
    .bind(...args)
    .first<{ c: number }>()
  const total = countRow?.c ?? 0

  const offset = (p.page - 1) * p.limit
  const rows = await db
    .prepare(
      `SELECT * FROM suggestions ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...args, p.limit, offset)
    .all<SuggestionRow>()

  return { total, items: rows.results }
}

export async function getSuggestion(db: D1Database, id: number): Promise<SuggestionRow | null> {
  return await db
    .prepare('SELECT * FROM suggestions WHERE id = ?')
    .bind(id)
    .first<SuggestionRow>()
}

export async function updateSuggestion(
  db: D1Database,
  id: number,
  patch: { status: Status; admin_note?: string }
): Promise<void> {
  await db
    .prepare(
      `UPDATE suggestions SET
         status = ?,
         admin_note = COALESCE(?, admin_note),
         reviewed_at = datetime('now'),
         reviewed_by = 'admin'
       WHERE id = ?`
    )
    .bind(patch.status, patch.admin_note ?? null, id)
    .run()
}

export interface ExportParams {
  source_id?: number
  include_completed: boolean
}

export async function exportSuggestions(
  db: D1Database,
  p: ExportParams
): Promise<SuggestionRow[]> {
  const statuses = p.include_completed ? ['accepted', 'completed'] : ['accepted']
  const placeholders = statuses.map(() => '?').join(',')
  const where: string[] = [`status IN (${placeholders})`]
  const args: unknown[] = [...statuses]
  if (p.source_id !== undefined) { where.push('source_id = ?'); args.push(p.source_id) }
  const rows = await db
    .prepare(
      `SELECT * FROM suggestions
       WHERE ${where.join(' AND ')}
       ORDER BY source_id ASC, page_num ASC, created_at ASC`
    )
    .bind(...args)
    .all<SuggestionRow>()
  return rows.results
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Re-run existing tests to confirm no regression**

Run: `cd backend && npx vitest run`

Expected: all pass (including Task 4 tests).

- [ ] **Step 4: Commit**

```bash
git add backend/src/server/services/suggestions.ts
git commit -m "feat(sugg): add D1 CRUD functions for suggestions"
```

---

## Task 6: Admin auth middleware (TDD)

**Files:**
- Create: `backend/src/server/middleware/adminAuth.ts`

- [ ] **Step 1: Write middleware**

Create `backend/src/server/middleware/adminAuth.ts`:

```typescript
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
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server/middleware/adminAuth.ts
git commit -m "feat(sugg): add admin cookie auth middleware"
```

Note: Auth logic (`verifyCookie` / `signCookie`) is already tested in Task 4's suggestions.test.ts. The middleware wrapper is thin enough that additional unit tests would be tautological; it's exercised end-to-end in the integration verification (Task 12).

---

## Task 7: Public route — POST /api/v1/suggestions

**Files:**
- Create: `backend/src/server/routes/suggestions.ts`

- [ ] **Step 1: Write the route**

Create `backend/src/server/routes/suggestions.ts`:

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { CloudflareBindings } from '../types/env'
import { submitSuggestionSchema } from '../schemas/suggestion'
import { insertSuggestion, hashIp } from '../services/suggestions'

const routes = new Hono<{ Bindings: CloudflareBindings }>()

routes.post('/suggestions', zValidator('json', submitSuggestionSchema), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const ua = (c.req.header('User-Agent') || '').slice(0, 200)
  const ipHash = await hashIp(ip, c.env.WORKER_SALT)

  const id = await insertSuggestion(c.env.DB, {
    category: body.category,
    source_id: body.source_id,
    page_num: body.page_num,
    url: body.url,
    selected_text: body.selected_text,
    user_note: body.user_note,
    email: body.email,
    ip_hash: ipHash,
    user_agent: ua,
  })

  return c.json({ success: true, data: { id } })
})

export default routes
```

- [ ] **Step 2: Register route in api.ts**

Modify `backend/src/server/api.ts`:

Replace file contents with:

```typescript
import { Hono } from 'hono'
import type { CloudflareBindings } from './types/env'
import searchRoutes from './routes/search'
import entriesRoutes from './routes/entries'
import sourcesRoutes from './routes/sources'
import articlesRoutes from './routes/articles'
import suggestionsRoutes from './routes/suggestions'

const api = new Hono<{ Bindings: CloudflareBindings }>()

api.route('/', searchRoutes)
api.route('/', entriesRoutes)
api.route('/', sourcesRoutes)
api.route('/', articlesRoutes)
api.route('/', suggestionsRoutes)

export default api
```

- [ ] **Step 3: Ensure POST is not cached**

Verify `backend/src/index.tsx:24-31` cache middleware only applies to `GET` responses. Hono's `cache` middleware only caches `GET`/`HEAD` by default; nothing to change. If in doubt, add a comment; do not modify.

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manual smoke test via curl**

Start dev server: `./dev.sh` (background) or in separate terminal.

Then in another terminal:

```bash
curl -X POST http://localhost:8787/api/v1/suggestions \
  -H "Content-Type: application/json" \
  -d '{"category":"text_revision","url":"http://x/y","selected_text":"test 潮州","user_note":"typo"}'
```

Expected: `{"success":true,"data":{"id":<num>}}`.

Verify DB row:

```bash
sqlite3 tmp/openteochew.db "SELECT id, category, selected_text, user_note, ip_hash FROM suggestions ORDER BY id DESC LIMIT 1"
```

Expected: row with `text_revision`, `test 潮州`, `typo`, and a 16-hex `ip_hash`.

Test validation failure:

```bash
curl -X POST http://localhost:8787/api/v1/suggestions \
  -H "Content-Type: application/json" \
  -d '{"category":"text_revision","url":"http://x/y"}'
```

Expected: HTTP 400 with Zod error mentioning `selected_text 與 user_note 至少一個非空`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server/routes/suggestions.ts backend/src/server/api.ts
git commit -m "feat(sugg): add POST /api/v1/suggestions public endpoint"
```

---

## Task 8: Admin routes — login / list / patch / export

**Files:**
- Create: `backend/src/server/routes/admin.ts`
- Modify: `backend/src/server/api.ts`

- [ ] **Step 1: Write admin routes**

Create `backend/src/server/routes/admin.ts`:

```typescript
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
    const suffix = q.source_id ? `source${q.source_id}_` : ''
    const filename = `suggestions_${suffix}${yyyymmdd}.csv`

    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)
    c.header('Cache-Control', 'no-store')
    return c.body(csv)
  }
)

export default routes
```

- [ ] **Step 2: Register in api.ts**

Modify `backend/src/server/api.ts`:

```typescript
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
```

- [ ] **Step 3: Exclude /admin/* from cache middleware**

Modify `backend/src/index.tsx` — verify current CACHE_RULES do not match `/api/v1/admin/*`. Looking at existing rules (lines 8-15), none match `/admin`. No change needed, but add a comment above CACHE_RULES:

Change line 8 from:

```typescript
const CACHE_RULES: [RegExp, number][] = [
```

to:

```typescript
// Do NOT add /api/v1/admin/* here — admin endpoints must never be cached.
const CACHE_RULES: [RegExp, number][] = [
```

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

With dev server running and `ADMIN_TOKEN=dev-admin-token-change-me`:

```bash
# login
curl -c /tmp/cj -X POST http://localhost:8787/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token":"dev-admin-token-change-me"}'
```

Expected: `{"success":true}` + Set-Cookie `admin_session=...` in headers.

```bash
# list (with cookie)
curl -b /tmp/cj "http://localhost:8787/api/v1/admin/suggestions?status=all"
```

Expected: `{"success":true,"data":{"total":<n>,"page":1,"items":[...]}}` — includes the row from Task 7 smoke test.

```bash
# list without cookie
curl "http://localhost:8787/api/v1/admin/suggestions?status=all"
```

Expected: HTTP 401 `{"success":false,"error":"unauthorized"}`.

```bash
# patch to accepted
curl -b /tmp/cj -X PATCH http://localhost:8787/api/v1/admin/suggestions/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted","admin_note":"looks good"}'
```

Expected: `{"success":true}`.

```bash
# illegal transition pending -> completed on a fresh row
curl -X POST http://localhost:8787/api/v1/suggestions \
  -H "Content-Type: application/json" \
  -d '{"category":"feedback","url":"http://x","user_note":"test"}'
# assume returned id=2
curl -b /tmp/cj -X PATCH http://localhost:8787/api/v1/admin/suggestions/2 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

Expected: HTTP 400 with `illegal transition pending -> completed`.

```bash
# accept then complete
curl -b /tmp/cj -X PATCH http://localhost:8787/api/v1/admin/suggestions/2 \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
curl -b /tmp/cj -X PATCH http://localhost:8787/api/v1/admin/suggestions/2 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

Expected: both `{"success":true}`.

```bash
# export CSV (default excludes completed)
curl -b /tmp/cj "http://localhost:8787/api/v1/admin/suggestions/export.csv"
```

Expected: CSV response starting with BOM (`\xef\xbb\xbf`), header line, and only rows with `status=accepted` (not `completed`).

```bash
# export CSV including completed
curl -b /tmp/cj "http://localhost:8787/api/v1/admin/suggestions/export.csv?include_completed=true"
```

Expected: CSV including both accepted and completed rows.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server/routes/admin.ts backend/src/server/api.ts backend/src/index.tsx
git commit -m "feat(sugg): add admin routes (login, list, patch, export)"
```

---

## Task 9: Frontend API client + router routes

**Files:**
- Create: `web/src/api/suggestions.ts`
- Modify: `web/src/router/index.js`

- [ ] **Step 1: Write API client**

Create `web/src/api/suggestions.ts`:

```typescript
import { request } from './client'

export interface SuggestionInput {
  category: 'text_revision' | 'data_contribution' | 'feedback'
  source_id?: number
  page_num?: number
  url: string
  selected_text?: string
  user_note?: string
  email?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return json.data as T
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return (json.data ?? {}) as T
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`)
  return json.data as T
}

export const suggestionsApi = {
  submit(input: SuggestionInput) {
    return post<{ id: number }>('/api/v1/suggestions', input)
  },
}

export const adminApi = {
  login(token: string) {
    return post<{}>('/api/v1/admin/login', { token })
  },
  list(params: Record<string, string | number | undefined>) {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v))
    })
    return getJson<{ total: number; page: number; items: any[] }>(
      `/api/v1/admin/suggestions?${q.toString()}`
    )
  },
  patch(id: number, body: { status: string; admin_note?: string }) {
    return patchJson<{}>(`/api/v1/admin/suggestions/${id}`, body)
  },
  exportUrl(source_id?: number, include_completed = false): string {
    const q = new URLSearchParams()
    if (source_id) q.set('source_id', String(source_id))
    if (include_completed) q.set('include_completed', 'true')
    return `/api/v1/admin/suggestions/export.csv?${q.toString()}`
  },
}
```

- [ ] **Step 2: Register router routes + titles**

Modify `web/src/router/index.js`:

After the existing `License` route (after line 51), insert (before the closing `]`):

```javascript
  ,
  {
    path: '/suggest',
    name: 'Suggest',
    component: () => import('../pages/SuggestPage.vue')
  },
  {
    path: '/admin',
    name: 'AdminLogin',
    component: () => import('../pages/admin/AdminLogin.vue')
  },
  {
    path: '/admin/suggestions',
    name: 'SuggestionsAdmin',
    component: () => import('../pages/admin/SuggestionsAdmin.vue')
  }
```

Update the `titles` object (add three entries):

```javascript
  Suggest: '反饋建議 — 潮州話開放資料庫',
  AdminLogin: '管理 — 潮州話開放資料庫',
  SuggestionsAdmin: '建議審核 — 潮州話開放資料庫',
```

- [ ] **Step 3: Commit**

```bash
git add web/src/api/suggestions.ts web/src/router/index.js
git commit -m "feat(sugg): add frontend api client and router routes"
```

---

## Task 10: CSS tokens for suggest UI

**Files:**
- Modify: `web/src/styles/tokens.css` (append at end)

- [ ] **Step 1: Append styles**

Append to `web/src/styles/tokens.css`:

```css
/* --- Selection popover --- */
.selection-popover {
  position: absolute;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 4px;
}
.selection-popover-btn {
  background: var(--accent);
  color: #fff;
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.selection-popover-btn:hover { background: var(--accent-active); }

/* --- Suggest modal --- */
.suggest-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(20,20,19,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  padding: 16px;
}
.suggest-modal {
  background: var(--surface);
  border-radius: 8px;
  max-width: 560px; width: 100%;
  max-height: 90vh; overflow-y: auto;
  padding: 24px;
}
.suggest-modal h2 { margin-top: 0; font-size: 18px; }
.suggest-form label { display: block; margin-top: 12px; font-size: 13px; color: var(--fg-2); }
.suggest-form textarea,
.suggest-form input[type="email"] {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-family: inherit;
  font-size: 14px;
  background: var(--bg);
  color: var(--fg);
  box-sizing: border-box;
}
.suggest-form textarea { resize: vertical; min-height: 60px; }
.suggest-form .radio-group { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
.suggest-form .radio-group label {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 0; cursor: pointer;
}
.suggest-form .char-count { font-size: 11px; color: var(--meta); text-align: right; }
.suggest-form .actions { margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end; }
.suggest-form .btn-primary,
.suggest-form .btn-secondary {
  border: 0; border-radius: 4px; padding: 8px 16px; cursor: pointer;
  font-size: 14px;
}
.suggest-form .btn-primary { background: var(--accent); color: #fff; }
.suggest-form .btn-primary:hover:not(:disabled) { background: var(--accent-active); }
.suggest-form .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.suggest-form .btn-secondary { background: var(--surface-warm); color: var(--fg); }
.suggest-form .thanks { padding: 20px; text-align: center; color: var(--accent); }
.suggest-form .error { color: #b23; font-size: 13px; margin-top: 8px; }

/* --- Admin --- */
.admin-page { max-width: 1080px; margin: 0 auto; padding: 24px 16px; }
.admin-login { max-width: 400px; margin: 100px auto; padding: 32px; background: var(--surface); border-radius: 8px; }
.admin-login h1 { margin-top: 0; font-size: 20px; }
.admin-login input { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px; margin: 12px 0; box-sizing: border-box; }
.admin-login button { width: 100%; padding: 10px; background: var(--accent); color: #fff; border: 0; border-radius: 4px; cursor: pointer; }

.admin-toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.admin-toolbar select, .admin-toolbar input, .admin-toolbar button {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px;
  background: var(--surface); color: var(--fg); font-size: 14px;
}
.admin-toolbar button.primary { background: var(--accent); color: #fff; border-color: var(--accent); cursor: pointer; }

.sugg-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: var(--surface);
}
.sugg-card-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--meta); }
.sugg-status { padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; }
.sugg-status-pending  { background: #fde68a; color: #78350f; }
.sugg-status-accepted { background: #bbf7d0; color: #14532d; }
.sugg-status-completed{ background: #e0e7ff; color: #3730a3; }
.sugg-status-rejected { background: #fecaca; color: #7f1d1d; }
.sugg-body { margin-top: 8px; font-size: 14px; }
.sugg-body .field { margin: 6px 0; }
.sugg-body .field-label { color: var(--meta); font-size: 12px; }
.sugg-body pre { background: var(--bg); padding: 6px 8px; border-radius: 3px; white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 2px 0; }
.sugg-actions { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.sugg-actions button { padding: 4px 12px; border: 1px solid var(--border); background: var(--surface); border-radius: 3px; cursor: pointer; font-size: 13px; }
.sugg-actions button.accept  { border-color: #16a34a; color: #14532d; }
.sugg-actions button.reject  { border-color: #dc2626; color: #7f1d1d; }
.sugg-actions button.complete{ border-color: #4f46e5; color: #3730a3; }
.sugg-actions button.undo    { border-color: var(--border); color: var(--muted); }
.sugg-actions input[type="text"] { flex: 1; min-width: 200px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 3px; font-size: 13px; }
```

- [ ] **Step 2: Commit**

```bash
git add web/src/styles/tokens.css
git commit -m "feat(sugg): add CSS for popover, modal, and admin UI"
```

---

## Task 11: SuggestForm + SuggestModal + SelectionPopover components

**Files:**
- Create: `web/src/components/SuggestForm.vue`
- Create: `web/src/components/SuggestModal.vue`
- Create: `web/src/components/SelectionPopover.vue`

- [ ] **Step 1: Write SuggestForm.vue (shared form body)**

Create `web/src/components/SuggestForm.vue`:

```vue
<template>
  <div v-if="submitted" class="thanks">
    {{ t2s('感謝您的建議！') }}
  </div>
  <form v-else class="suggest-form" @submit.prevent="onSubmit">
    <label>{{ t2s('類別') }}</label>
    <div class="radio-group">
      <label><input type="radio" value="text_revision" v-model="category"> {{ t2s('文本修訂') }}</label>
      <label><input type="radio" value="data_contribution" v-model="category"> {{ t2s('資料貢獻') }}</label>
      <label><input type="radio" value="feedback" v-model="category"> {{ t2s('反饋建議') }}</label>
    </div>

    <template v-if="showSelectedText">
      <label>{{ t2s('原文片段') }} <span class="char-count">{{ selectedText.length }}/500</span></label>
      <textarea rows="3" v-model="selectedText" maxlength="500" :placeholder="t2s('（自動填入劃選內容，可編輯）')"></textarea>
    </template>

    <label>{{ t2s('補充說明') }} <span class="char-count">{{ userNote.length }}/500</span></label>
    <textarea rows="4" v-model="userNote" maxlength="500" :placeholder="t2s('請描述問題或建議')"></textarea>

    <label>{{ t2s('Email（選填，方便回覆）') }}</label>
    <input type="email" v-model="email" maxlength="254" placeholder="you@example.com" />

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <div class="actions">
      <button v-if="showCancel" type="button" class="btn-secondary" @click="$emit('cancel')">{{ t2s('取消') }}</button>
      <button type="submit" class="btn-primary" :disabled="submitting || !canSubmit">
        {{ submitting ? t2s('提交中…') : t2s('提交') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { suggestionsApi } from '../api/suggestions'
import { useSimplified } from '../composables/useSimplified'

const props = defineProps({
  initialCategory: { type: String, default: 'feedback' },
  initialSelectedText: { type: String, default: '' },
  sourceId: { type: Number, default: null },
  pageNum: { type: Number, default: null },
  showCancel: { type: Boolean, default: false },
  showSelectedText: { type: Boolean, default: false },
})

const emit = defineEmits(['submitted', 'cancel'])

const { t2s } = useSimplified()
const route = useRoute()

const category = ref(props.initialCategory)
const selectedText = ref(props.initialSelectedText || '')
const userNote = ref('')
const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMsg = ref('')

watch(() => props.initialSelectedText, (v) => { selectedText.value = v || '' })
watch(() => props.initialCategory, (v) => { category.value = v })

const canSubmit = computed(() => {
  return (selectedText.value.trim().length > 0) || (userNote.value.trim().length > 0)
})

async function onSubmit() {
  errorMsg.value = ''
  submitting.value = true
  try {
    await suggestionsApi.submit({
      category: category.value,
      source_id: props.sourceId || undefined,
      page_num: props.pageNum || undefined,
      url: window.location.href,
      selected_text: selectedText.value.trim() || undefined,
      user_note: userNote.value.trim() || undefined,
      email: email.value.trim() || undefined,
    })
    submitted.value = true
    emit('submitted')
  } catch (e) {
    errorMsg.value = e.message || t2s('提交失敗，請稍後再試')
  } finally {
    submitting.value = false
  }
}
</script>
```

- [ ] **Step 2: Write SuggestModal.vue**

Create `web/src/components/SuggestModal.vue`:

```vue
<template>
  <div v-if="open" class="suggest-modal-overlay" @click.self="onClose">
    <div class="suggest-modal">
      <h2>{{ t2s('提交建議') }}</h2>
      <SuggestForm
        :initial-category="initialCategory"
        :initial-selected-text="initialSelectedText"
        :source-id="sourceId"
        :page-num="pageNum"
        :show-cancel="true"
        :show-selected-text="true"
        @cancel="onClose"
        @submitted="onSubmitted"
      />
    </div>
  </div>
</template>

<script setup>
import SuggestForm from './SuggestForm.vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

defineProps({
  open: { type: Boolean, default: false },
  initialCategory: { type: String, default: 'text_revision' },
  initialSelectedText: { type: String, default: '' },
  sourceId: { type: Number, default: null },
  pageNum: { type: Number, default: null },
})

const emit = defineEmits(['close', 'submitted'])

function onClose() { emit('close') }
function onSubmitted() {
  setTimeout(() => emit('close'), 2000)
  emit('submitted')
}
</script>
```

- [ ] **Step 3: Write SelectionPopover.vue**

Create `web/src/components/SelectionPopover.vue`:

```vue
<template>
  <div
    v-if="visible"
    class="selection-popover"
    :style="{ top: y + 'px', left: x + 'px' }"
    @mousedown.prevent
  >
    <button class="selection-popover-btn" @click="onClick">
      {{ t2s('回報這段') }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

const props = defineProps({
  container: { type: Object, default: null }, // ref to DOM element
})
const emit = defineEmits(['select'])

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const currentText = ref('')

function checkSelection() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    visible.value = false
    return
  }
  const text = sel.toString().trim()
  if (!text) { visible.value = false; return }

  const range = sel.getRangeAt(0)
  const containerEl = props.container?.value || props.container
  if (containerEl && !containerEl.contains(range.commonAncestorContainer)) {
    visible.value = false
    return
  }
  if (text.length > 500) {
    visible.value = false
    return
  }
  const rect = range.getBoundingClientRect()
  const scrollY = window.scrollY || window.pageYOffset
  const scrollX = window.scrollX || window.pageXOffset
  x.value = Math.min(rect.right + scrollX + 4, window.innerWidth - 100 + scrollX)
  y.value = rect.bottom + scrollY + 4
  currentText.value = text
  visible.value = true
}

function onClick() {
  emit('select', currentText.value)
  window.getSelection()?.removeAllRanges()
  visible.value = false
}

function onMouseUp() { setTimeout(checkSelection, 10) }
function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) visible.value = false
}
function onScroll() { visible.value = false }

onMounted(() => {
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('touchend', onMouseUp)
  document.addEventListener('selectionchange', onSelectionChange)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('touchend', onMouseUp)
  document.removeEventListener('selectionchange', onSelectionChange)
  window.removeEventListener('scroll', onScroll, true)
})
</script>
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/SuggestForm.vue web/src/components/SuggestModal.vue web/src/components/SelectionPopover.vue
git commit -m "feat(sugg): add SuggestForm, SuggestModal, SelectionPopover components"
```

---

## Task 12: Wire popover + modal into SourceViewer

**Files:**
- Modify: `web/src/pages/thak/SourceViewer.vue`

- [ ] **Step 1: Import new components**

Modify `web/src/pages/thak/SourceViewer.vue`:

After existing imports (around line 100-101, after `useSimplified` import), add:

```javascript
import SelectionPopover from '../../components/SelectionPopover.vue'
import SuggestModal from '../../components/SuggestModal.vue'
```

- [ ] **Step 2: Add refs and state**

After `const lightboxOpen = ref(false)` (~line 117), add:

```javascript
const ocrEntriesRef = ref(null)
const suggestOpen = ref(false)
const suggestSelectedText = ref('')
```

- [ ] **Step 3: Handler function**

Anywhere in `<script setup>` (e.g. before `onMounted(loadData)` at line 187), add:

```javascript
function onSelectionReport(text) {
  suggestSelectedText.value = text
  suggestOpen.value = true
}
```

- [ ] **Step 4: Attach ref to OCR container and mount components in template**

In the template, locate the `<div v-html="renderedOcr">` element on line 44:

```html
<div v-if="renderedOcr" class="ocr-entries" v-html="renderedOcr"></div>
```

Wrap it with a ref:

```html
<div ref="ocrEntriesRef">
  <div v-if="renderedOcr" class="ocr-entries" v-html="renderedOcr"></div>
</div>
```

At the very end of the `<template>` (after the closing `</div>` of `lightbox-overlay` and before `</template>`), add:

```html
<SelectionPopover :container="ocrEntriesRef" @select="onSelectionReport" />
<SuggestModal
  :open="suggestOpen"
  initial-category="text_revision"
  :initial-selected-text="suggestSelectedText"
  :source-id="Number(props.id)"
  :page-num="pageNum"
  @close="suggestOpen = false"
/>
```

- [ ] **Step 5: Manual verification**

Run `./dev.sh` (fresh terminal) and `cd web && npm run dev` (another terminal, if separate).

Visit `http://localhost:5173/#/thak/source/1?page=1` (or whatever dev port).

- [ ] Select some OCR text with mouse → popover appears near selection
- [ ] Click popover → modal opens with `selected_text` prefilled
- [ ] Submit → thanks message → auto-close after 2s
- [ ] Verify D1 row via `sqlite3 tmp/openteochew.db "SELECT * FROM suggestions ORDER BY id DESC LIMIT 1"` — should have correct `source_id`, `page_num`, `url`, `selected_text`, `category=text_revision`
- [ ] Clear selection (click elsewhere) → popover disappears
- [ ] Select empty / whitespace-only → popover does not appear

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/thak/SourceViewer.vue
git commit -m "feat(sugg): wire selection popover and suggest modal into SourceViewer"
```

---

## Task 13: SuggestPage (independent feedback page)

**Files:**
- Create: `web/src/pages/SuggestPage.vue`
- Modify: `web/src/components/TopNav.vue`

- [ ] **Step 1: Write SuggestPage.vue**

Create `web/src/pages/SuggestPage.vue`:

```vue
<template>
  <div class="container" style="max-width:640px;padding:32px 16px">
    <h1>{{ t2s('反饋建議') }}</h1>
    <p style="color:var(--muted);line-height:1.6">
      {{ t2s('歡迎提交網站功能反饋、資料貢獻，或您在瀏覽時想到的任何建議。') }}
    </p>
    <p style="color:var(--muted);font-size:13px">
      {{ t2s('若您想回報特定頁面的 OCR 或翻譯錯誤，也可以直接在該頁面劃選文字後點擊「回報這段」。') }}
    </p>
    <div style="margin-top:24px;padding:20px;background:var(--surface);border-radius:8px">
      <SuggestForm
        initial-category="feedback"
        :show-selected-text="false"
        :show-cancel="false"
      />
    </div>
  </div>
</template>

<script setup>
import SuggestForm from '../components/SuggestForm.vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>
```

- [ ] **Step 2: Add TopNav link**

Modify `web/src/components/TopNav.vue` line 11 area:

Change the `<nav>` block:

```html
<nav class="nav-tabs">
  <router-link to="/" class="nav-tab" :class="{ active: isChheActive }">Chhê <span class="nav-tab-cn">{{ locale.t2s('查') }}</span></router-link>
  <router-link to="/thak" class="nav-tab" :class="{ active: isThakActive }">Tha̍k <span class="nav-tab-cn">{{ locale.t2s('讀') }}</span></router-link>
  <router-link to="/about" class="nav-tab" :class="{ active: isAboutActive }">{{ locale.t2s('關於') }}</router-link>
  <router-link to="/suggest" class="nav-tab" :class="{ active: isSuggestActive }">{{ locale.t2s('反饋') }}</router-link>
</nav>
```

Update the computed section:

```javascript
const isChheActive = computed(() => route.path === '/' || route.path.startsWith('/chhe'))
const isThakActive = computed(() => route.path.startsWith('/thak'))
const isAboutActive = computed(() => route.path === '/about')
const isSuggestActive = computed(() => route.path === '/suggest')
```

**Important:** Do NOT add any link to `/admin` — admin is entry-hidden per spec §4.4.

- [ ] **Step 3: Manual verification**

Visit `http://localhost:5173/#/suggest`:

- [ ] Page renders with feedback form (no selected_text field)
- [ ] Submit feedback → thanks message → row in DB with `category=feedback`, `source_id=NULL`, `page_num=NULL`
- [ ] TopNav shows "反饋" link
- [ ] Verify no `/admin` link visible in TopNav / footer / anywhere

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/SuggestPage.vue web/src/components/TopNav.vue
git commit -m "feat(sugg): add /suggest page and TopNav link"
```

---

## Task 14: AdminLogin page

**Files:**
- Create: `web/src/pages/admin/AdminLogin.vue`

- [ ] **Step 1: Write AdminLogin.vue**

Create `web/src/pages/admin/AdminLogin.vue`:

```vue
<template>
  <div class="admin-login">
    <h1>{{ t2s('管理後台') }}</h1>
    <p style="color:var(--muted);font-size:13px">{{ t2s('輸入管理員 token 以登入。') }}</p>
    <form @submit.prevent="onSubmit">
      <input
        type="password"
        v-model="token"
        autocomplete="off"
        :placeholder="t2s('Admin Token')"
        required
      />
      <div v-if="err" style="color:#b23;font-size:13px;margin-bottom:8px">{{ err }}</div>
      <button type="submit" :disabled="loading">
        {{ loading ? t2s('登入中…') : t2s('登入') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../../api/suggestions'
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()

const router = useRouter()
const token = ref('')
const loading = ref(false)
const err = ref('')

async function onSubmit() {
  err.value = ''
  loading.value = true
  try {
    await adminApi.login(token.value)
    router.replace('/admin/suggestions')
  } catch (e) {
    err.value = e.message || t2s('登入失敗')
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: Manual verification**

Visit `http://localhost:5173/#/admin`:

- [ ] Login page renders
- [ ] Wrong token → error message
- [ ] Correct token (`dev-admin-token-change-me`) → redirects to `/admin/suggestions`
- [ ] Reload `/admin/suggestions` → still authenticated (cookie persists)

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/admin/AdminLogin.vue
git commit -m "feat(sugg): add AdminLogin page"
```

---

## Task 15: SuggestionsAdmin page

**Files:**
- Create: `web/src/pages/admin/SuggestionsAdmin.vue`

- [ ] **Step 1: Write SuggestionsAdmin.vue**

Create `web/src/pages/admin/SuggestionsAdmin.vue`:

```vue
<template>
  <div class="admin-page">
    <h1>{{ t2s('建議審核') }}</h1>

    <div class="admin-toolbar">
      <label>
        {{ t2s('狀態') }}
        <select v-model="filterStatus" @change="reload(1)">
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="completed">completed</option>
          <option value="rejected">rejected</option>
          <option value="all">all</option>
        </select>
      </label>
      <label>
        {{ t2s('類別') }}
        <select v-model="filterCategory" @change="reload(1)">
          <option value="all">all</option>
          <option value="text_revision">text_revision</option>
          <option value="data_contribution">data_contribution</option>
          <option value="feedback">feedback</option>
        </select>
      </label>
      <label>
        {{ t2s('來源 ID') }}
        <input type="number" min="1" v-model.number="filterSourceId" @change="reload(1)" style="width:80px" />
      </label>
    </div>

    <div class="admin-toolbar" style="border-top:1px solid var(--border);padding-top:12px">
      <label>
        {{ t2s('匯出來源') }}
        <select v-model="exportSourceId">
          <option :value="null">{{ t2s('全部') }}</option>
          <option v-for="n in knownSourceIds" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <label>
        <input type="checkbox" v-model="exportIncludeCompleted" />
        {{ t2s('包含已完成') }}
      </label>
      <a class="primary" :href="exportHref" style="text-decoration:none;padding:6px 12px;background:var(--accent);color:#fff;border-radius:4px">
        {{ t2s('匯出 CSV') }}
      </a>
    </div>

    <div v-if="loading" style="color:var(--muted);padding:20px 0">{{ t2s('載入中…') }}</div>
    <div v-else-if="!items.length" style="color:var(--muted);padding:20px 0">{{ t2s('沒有符合條件的建議') }}</div>
    <div v-else>
      <div v-for="s in items" :key="s.id" class="sugg-card">
        <div class="sugg-card-head">
          <span>#{{ s.id }}</span>
          <span class="sugg-status" :class="'sugg-status-' + s.status">{{ s.status }}</span>
          <span>{{ s.category }}</span>
          <span v-if="s.source_id">source {{ s.source_id }}<span v-if="s.page_num">, p.{{ s.page_num }}</span></span>
          <span>{{ s.created_at }}</span>
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" style="margin-left:auto">→ {{ t2s('原頁') }}</a>
        </div>
        <div class="sugg-body">
          <div v-if="s.selected_text" class="field">
            <div class="field-label">{{ t2s('原文片段') }}</div>
            <pre>{{ s.selected_text }}</pre>
          </div>
          <div v-if="s.user_note" class="field">
            <div class="field-label">{{ t2s('補充說明') }}</div>
            <pre>{{ s.user_note }}</pre>
          </div>
          <div v-if="s.email" class="field">
            <div class="field-label">Email</div>
            <span>{{ s.email }}</span>
          </div>
          <div v-if="s.admin_note" class="field">
            <div class="field-label">{{ t2s('審核備註') }}</div>
            <pre>{{ s.admin_note }}</pre>
          </div>
        </div>
        <div class="sugg-actions">
          <input type="text" v-model="noteInputs[s.id]" :placeholder="t2s('備註（可選）')" />
          <template v-if="s.status === 'pending'">
            <button class="accept" @click="doPatch(s, 'accepted')">✓ {{ t2s('接受') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">✗ {{ t2s('拒絕') }}</button>
          </template>
          <template v-else-if="s.status === 'accepted'">
            <button class="complete" @click="doPatch(s, 'completed')">✓ {{ t2s('完成') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">{{ t2s('改為拒絕') }}</button>
          </template>
          <template v-else-if="s.status === 'completed'">
            <button class="undo" @click="doPatch(s, 'accepted')">↶ {{ t2s('取消完成') }}</button>
          </template>
          <template v-else-if="s.status === 'rejected'">
            <button class="undo" @click="doPatch(s, 'pending')">↶ {{ t2s('復原') }}</button>
          </template>
        </div>
      </div>

      <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;color:var(--muted)">
        <button :disabled="page <= 1" @click="reload(page - 1)">← {{ t2s('上一頁') }}</button>
        <span>{{ t2s('第') }} {{ page }} / {{ totalPages }} {{ t2s('頁') }}（{{ total }} {{ t2s('條') }}）</span>
        <button :disabled="page >= totalPages" @click="reload(page + 1)">{{ t2s('下一頁') }} →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../../api/suggestions'
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()

const router = useRouter()

const items = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loading = ref(false)
const noteInputs = ref({})

const filterStatus = ref('pending')
const filterCategory = ref('all')
const filterSourceId = ref(null)

const exportSourceId = ref(null)
const exportIncludeCompleted = ref(false)
const knownSourceIds = ref([1, 2, 3])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const exportHref = computed(() =>
  adminApi.exportUrl(exportSourceId.value || undefined, exportIncludeCompleted.value)
)

async function reload(nextPage = page.value) {
  loading.value = true
  try {
    const data = await adminApi.list({
      status: filterStatus.value,
      category: filterCategory.value,
      source_id: filterSourceId.value || undefined,
      page: nextPage,
      limit: limit.value,
    })
    items.value = data.items
    total.value = data.total
    page.value = nextPage
  } catch (e) {
    if (String(e.message).includes('unauthorized') || String(e.message).includes('401')) {
      router.replace('/admin')
      return
    }
    alert(e.message)
  } finally {
    loading.value = false
  }
}

async function doPatch(s, newStatus) {
  try {
    await adminApi.patch(s.id, {
      status: newStatus,
      admin_note: noteInputs.value[s.id] || undefined,
    })
    noteInputs.value[s.id] = ''
    await reload()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(reload)
</script>
```

- [ ] **Step 2: Manual verification**

With dev running + already logged in:

Visit `http://localhost:5173/#/admin/suggestions`:

- [ ] Page loads with pending items from earlier tests
- [ ] Change status filter → list updates
- [ ] Click "接受" on a pending row → row moves to accepted
- [ ] Click "完成" on an accepted row → row moves to completed
- [ ] Click "取消完成" on completed → back to accepted
- [ ] Try clicking illegal state (should not be exposed in UI, but test PATCH via curl still returns 400)
- [ ] Click "匯出 CSV" → downloads file. Open in editor / Excel — Chinese not garbled.
- [ ] Toggle "包含已完成" checkbox → export URL query string changes
- [ ] Log out via `document.cookie="admin_session=; Max-Age=0"` in DevTools, reload → redirected to `/admin`

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/admin/SuggestionsAdmin.vue
git commit -m "feat(sugg): add SuggestionsAdmin review page"
```

---

## Task 16: robots.txt

**Files:**
- Create: `web/public/robots.txt` (or modify if exists)

- [ ] **Step 1: Check for existing file**

```bash
ls web/public/robots.txt 2>/dev/null || echo "does not exist"
```

- [ ] **Step 2: Write robots.txt**

Create or overwrite `web/public/robots.txt`:

```
User-agent: *
Disallow: /admin
Disallow: /admin/
Allow: /
```

- [ ] **Step 3: Commit**

```bash
git add web/public/robots.txt
git commit -m "feat(sugg): disallow crawlers on /admin"
```

---

## Task 17: End-to-end integration check

**Files:** (none — verification only)

- [ ] **Step 1: Full build check**

```bash
./build.sh
```

Expected: build succeeds, `backend/public/` populated with Vue build.

- [ ] **Step 2: Full unit test suite**

```bash
cd backend && npx vitest run
```

Expected: all tests pass (new suggestions tests + existing search/normalize tests).

- [ ] **Step 3: Type-check all packages**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Complete manual test walkthrough**

Ensure `./dev.sh` running with fresh D1 (or the state from prior tasks). Complete each item from spec §7.1:

- [ ] SourceViewer 劃選文字 → popover 出現在正確位置
- [ ] 點 popover 按鈕 → modal 開啟，預填 `selected_text`
- [ ] 500 字元超限 → 前端截斷（`maxlength="500"` on textarea）+ 後端拒絕若前端繞過
- [ ] 提交成功 → 感謝訊息 → D1 有紀錄
- [ ] 未登入訪問 `/admin/suggestions` → API 401 → 前端導向 `/admin`
- [ ] 輸入錯 token → 401 + 錯誤提示
- [ ] 輸入對 token → cookie 設立 → 進入審核頁
- [ ] 審核頁篩選、accept、reject、admin_note 都正確持久化
- [ ] `accepted` 建議顯示「完成」按鈕，點擊後 status → `completed`
- [ ] `completed` 建議顯示「取消完成」按鈕，點擊後 status → `accepted`
- [ ] 非法狀態轉換（如 pending → completed）後端回 400（用 curl 驗）
- [ ] 匯出 CSV：預設只含 `accepted`（不含 `completed`）
- [ ] 匯出 CSV：勾「包含已完成」時同時含 `accepted` + `completed`
- [ ] CSV 開 Excel/LibreOffice 中文不亂碼（UTF-8 BOM）
- [ ] TopNav 有「反饋」連結；沒有任何 `/admin` 入口

- [ ] **Step 5: robots.txt served**

```bash
curl http://localhost:8787/robots.txt
```

Expected: `Disallow: /admin` visible in output.

- [ ] **Step 6: If all pass, commit any remaining fixes**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(sugg): address issues found during e2e verification"
```

If nothing to commit, proceed to Task 18.

---

## Task 18: Deploy to production

**Files:** (none — deployment only)

- [ ] **Step 1: Apply migration to remote D1**

```bash
cd backend
npx wrangler d1 execute openteochew-db --remote --file ../scripts/008_suggestions.sql
```

Expected: successful execution output.

Verify:

```bash
npx wrangler d1 execute openteochew-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='suggestions'"
```

Expected: row returned with `name=suggestions`.

- [ ] **Step 2: Set production secrets**

Generate secure random values first (do NOT reuse dev values):

```bash
openssl rand -hex 32   # for ADMIN_TOKEN — save this somewhere secure, you'll need to log in with it
openssl rand -hex 32   # for WORKER_SALT — never needs to be recalled
```

Set them:

```bash
cd backend
npx wrangler secret put ADMIN_TOKEN
# paste the first hex value at the prompt
npx wrangler secret put WORKER_SALT
# paste the second hex value at the prompt
```

Verify:

```bash
npx wrangler secret list
```

Expected: both secrets listed.

- [ ] **Step 3: Deploy**

```bash
./deploy.sh
```

Expected: successful deploy, URL printed.

- [ ] **Step 4: Production smoke test**

Visit `https://openteochew.com/#/thak/source/1?page=1`:

- [ ] Select OCR text → popover appears
- [ ] Submit a test suggestion (marked as "TEST-DELETE-ME" in user_note)
- [ ] Verify success

Visit `https://openteochew.com/#/suggest`:

- [ ] Feedback form renders
- [ ] Submit a test feedback

Visit `https://openteochew.com/#/admin`:

- [ ] Login with the ADMIN_TOKEN from Step 2
- [ ] See the test suggestions in `/admin/suggestions`
- [ ] Accept them, then complete them
- [ ] Delete the test rows via wrangler:

```bash
npx wrangler d1 execute openteochew-db --remote --command "DELETE FROM suggestions WHERE user_note LIKE '%TEST-DELETE-ME%'"
```

- [ ] **Step 5: Verify no admin link in production**

Load `https://openteochew.com/` and inspect the TopNav / footer — confirm no `/admin` links visible.

`curl https://openteochew.com/robots.txt` — confirm `Disallow: /admin` present.

- [ ] **Step 6: Merge feat branch to main**

```bash
git checkout main
git merge --no-ff feat/YYYYMMDD/suggestions
git push
```

(Adjust branch name per your local convention. Per AGENTS.md: `feat/年月日/功能說明`.)

---

## Rollback plan

If production has serious issues:

1. Remove admin route registration in `backend/src/server/api.ts` and redeploy — visitor-side keeps working, admin unavailable
2. Or remove both `suggestionsRoutes` and `adminRoutes` — endpoints return 404, submission form shows an error but the rest of the site is unaffected
3. `suggestions` table is standalone (no FK to other tables) so it can be dropped safely: `DROP TABLE suggestions;`

Migration 008 is additive-only; no destructive changes to existing tables.

---

## Summary of files touched

| Path | Action |
|---|---|
| `scripts/008_suggestions.sql` | Create |
| `backend/src/server/types/env.ts` | Modify |
| `backend/.dev.vars` | Create (gitignored) |
| `.gitignore` | Modify (if needed) |
| `backend/src/server/schemas/suggestion.ts` | Create |
| `backend/src/server/services/suggestions.ts` | Create |
| `backend/src/server/services/suggestions.test.ts` | Create |
| `backend/src/server/middleware/adminAuth.ts` | Create |
| `backend/src/server/routes/suggestions.ts` | Create |
| `backend/src/server/routes/admin.ts` | Create |
| `backend/src/server/api.ts` | Modify |
| `backend/src/index.tsx` | Modify (comment only) |
| `web/src/api/suggestions.ts` | Create |
| `web/src/router/index.js` | Modify |
| `web/src/components/SelectionPopover.vue` | Create |
| `web/src/components/SuggestForm.vue` | Create |
| `web/src/components/SuggestModal.vue` | Create |
| `web/src/pages/SuggestPage.vue` | Create |
| `web/src/pages/admin/AdminLogin.vue` | Create |
| `web/src/pages/admin/SuggestionsAdmin.vue` | Create |
| `web/src/pages/thak/SourceViewer.vue` | Modify |
| `web/src/components/TopNav.vue` | Modify |
| `web/src/styles/tokens.css` | Modify (append) |
| `web/public/robots.txt` | Create |

