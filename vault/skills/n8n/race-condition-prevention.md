---
id: skill-race-condition-locks
type: skill
title: "Race Condition Prevention with Redis Distributed Locks"
domain: n8n
tags: [concurrency, redis, distributed-locks, webhooks]
status: active
confidence: high
created: 2026-01-20
updated: 2026-02-15
connections:
  - target: concept-idempotency
    edge: depends_on
  - target: project-bot-farm-system
    edge: part_of
  - target: tool-redis-patterns
    edge: uses
---

# Race Condition Prevention with Redis Distributed Locks

## Context

When multiple webhook triggers fire simultaneously in n8n (e.g., Facebook callbacks), parallel executions can corrupt shared state like Google Sheets row counters or status fields.

## Pattern

Use Redis `SETNX` (set-if-not-exists) as a distributed lock:

1. **Acquire lock**: `SETNX lock:{resource} {execution_id} EX 30`
2. **If acquired** → proceed with critical section
3. **If lock exists** → wait 500ms and retry (max 3 attempts), or skip
4. **After completion**: `DEL lock:{resource}`
5. **Safety**: EX 30 ensures auto-expiry if workflow crashes

### n8n Implementation

```javascript
// In a Code node before the critical section
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);

const lockKey = `lock:sheets:${sheetId}`;
const acquired = await client.set(lockKey, $execution.id, 'EX', 30, 'NX');

if (!acquired) {
  // Another execution holds the lock
  return [{ json: { _skipped: true, reason: 'lock_held' } }];
}

// Proceed with Google Sheets update...
// After: await client.del(lockKey);
```

## Anti-Pattern

❌ Using n8n's "Execute Once" mode — only works per-trigger, not across concurrent webhook calls
❌ No lock expiry — crashed workflows leave permanent locks (deadlock)
❌ Locking too broadly — lock per-resource, not per-workflow

## Evidence

Tested in bot farm workflow: 0 race conditions over 30 days with 200+ daily concurrent executions.

## Related

- [[concept-idempotency]]
- [[project-bot-farm-system]]
