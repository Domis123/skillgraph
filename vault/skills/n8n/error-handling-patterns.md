---
id: skill-error-handling-n8n
type: skill
title: "Error Handling Patterns for n8n Workflows"
domain: n8n
tags: [error-handling, retry, dead-letter, workflow-design]
status: active
confidence: high
created: 2026-01-15
updated: 2026-02-20
connections:
  - target: tool-n8n-code-patterns
    edge: uses
  - target: concept-idempotency
    edge: depends_on
  - target: project-blog-writer-v5
    edge: part_of
  - target: project-bot-farm-system
    edge: part_of
---

# Error Handling Patterns for n8n Workflows

## Context

Complex n8n workflows (30+ nodes) fail in unpredictable ways: API rate limits, malformed JSON from AI, Google Sheets conflicts, S3 upload failures. Without proper error handling, a single failure can corrupt an entire batch run.

## Pattern: Layered Error Strategy

### Layer 1: Node-Level Try/Catch

Every Code node that parses external input wraps in try/catch with JSON salvage:

```javascript
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  // Salvage: try to find JSON block in messy output
  const m = String(raw).match(/\{[\s\S]*\}$/);
  if (m) obj = JSON.parse(m[0]);
  else throw new Error("LLM did not return valid JSON");
}
```

### Layer 2: Workflow Error Handler

Attach an Error Trigger workflow that catches unhandled failures and:
1. Logs error details to a Google Sheet ("Error Log" tab)
2. Sends Slack notification with workflow name + error message
3. Marks the failed item's status in the tracking sheet

### Layer 3: Graceful Degradation

For non-critical steps (e.g., image generation), use "Continue On Fail" setting and check `$json._error` in the next node. If image fails, article still publishes with placeholder.

### Layer 4: Retry with Backoff

For API-dependent nodes (OpenAI, Anthropic, Google), configure:
- Max retries: 3
- Wait between retries: exponential (1s, 2s, 4s)
- On final failure: route to error handler

## Anti-Pattern

❌ Using n8n's global "Continue On Fail" for everything — hides real errors
❌ No error logging — failures are silent and unrecoverable
❌ Retrying non-idempotent operations without deduplication

## Evidence

Error recovery rate improved from ~60% to ~95% after implementing layered strategy across blog writer and bot farm workflows.

## Related

- [[tool-n8n-code-patterns]]
- [[concept-idempotency]]
- [[project-blog-writer-v5]]
