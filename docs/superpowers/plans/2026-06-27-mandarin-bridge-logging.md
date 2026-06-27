# Mandarin Bridge Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend console logs that show Mandarin direct-search and bridge-search decisions during local Wrangler testing.

**Architecture:** Keep logging inside `backend/src/server/services/search.ts` near the bridge decision points. Use one stable prefix, `[search:mandarin_bridge]`, and structured objects so local logs are easy to scan and production logs remain queryable.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers console logging.

---

## File Structure

- Modify `backend/src/server/services/search.ts`: add `logMandarinBridge()` helper and call it for direct result, no-candidate fallback, and bridge result.
- Modify `backend/src/server/services/search.test.ts`: spy on `console.info` to verify log events.

## Task 1: Add failing logging tests

**Files:**
- Modify: `backend/src/server/services/search.test.ts`

- [ ] **Step 1: Add console spy setup**

Add imports:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
```

Add inside the describe block:

```ts
let infoSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  infoSpy.mockRestore()
})
```

- [ ] **Step 2: Add assertions to existing tests**

Direct test should assert:

```ts
expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
  event: 'direct_result',
  input: '電腦',
  traditional: '電腦',
  directTotal: 1,
})
```

Bridge test should assert two events:

```ts
expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
  event: 'bridge_terms',
  input: '电脑',
  traditional: '電腦',
  bridgeTerms: ['computer'],
})
expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
  event: 'bridge_result',
  input: '电脑',
  traditional: '電腦',
  bridgeTerms: ['computer'],
  bridgeTotal: 1,
})
```

No-candidate test should assert:

```ts
expect(infoSpy).toHaveBeenCalledWith('[search:mandarin_bridge]', {
  event: 'bridge_terms',
  input: '不存在',
  traditional: '不存在',
  bridgeTerms: [],
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
cd backend && npm test -- src/server/services/search.test.ts
```

Expected: FAIL because no `console.info` calls are emitted yet.

## Task 2: Implement logging

**Files:**
- Modify: `backend/src/server/services/search.ts`

- [ ] **Step 1: Add logging helper**

Add near helpers:

```ts
function logMandarinBridge(data: Record<string, unknown>) {
  console.info('[search:mandarin_bridge]', data)
}
```

- [ ] **Step 2: Log direct result**

After direct search returns in `searchEntries()`, log:

```ts
const traditional = toTraditional(params.q_mandarin)
logMandarinBridge({
  event: 'direct_result',
  input: params.q_mandarin,
  traditional,
  directTotal: direct.total,
})
```

- [ ] **Step 3: Log bridge terms**

After `findMandarinBridgeTerms()`, log:

```ts
logMandarinBridge({
  event: 'bridge_terms',
  input: params.q_mandarin,
  traditional,
  bridgeTerms,
})
```

- [ ] **Step 4: Log bridge result**

After fallback `runSearchEntries()`, log:

```ts
const bridge = await runSearchEntries(...)
logMandarinBridge({
  event: 'bridge_result',
  input: params.q_mandarin,
  traditional,
  bridgeTerms,
  bridgeTotal: bridge.total,
})
return bridge
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd backend && npm test -- src/server/services/search.test.ts
```

Expected: PASS.

## Task 3: Verify full build

**Files:**
- Uses: backend and root scripts

- [ ] **Step 1: Run full backend tests**

Run:

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```bash
cd backend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Run full project build**

Run:

```bash
./build.sh
```

Expected: PASS.

## Self-Review

- Spec coverage: logs direct total, bridge terms, and bridge total with original and traditional query values.
- Placeholder scan: no placeholders remain.
- Type consistency: log fields are `event`, `input`, `traditional`, `directTotal`, `bridgeTerms`, and `bridgeTotal`.
