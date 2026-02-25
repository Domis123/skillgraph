---
id: lesson-intent-type-mismatch
type: lesson
title: "Intent Type Mismatch Causes Workflow Routing Failures"
domain: n8n
tags: [routing, string-handling, google-sheets, bug]
status: active
confidence: high
created: 2026-02-10
updated: 2026-02-12
connections:
  - target: project-blog-writer-v5
    edge: part_of
  - target: tool-n8n-code-patterns
    edge: uses
---

# Intent Type Mismatch Causes Workflow Routing Failures

## What Happened

Articles were routed to the wrong writer workflow or failed entirely. An "informational" article would get sent to the review writer, or a Switch node would hit the fallback/error path.

## Root Cause

The `intent_type` field from Google Sheets had two issues:
1. **Case sensitivity**: "Information" vs "information" vs "INFORMATION"
2. **Trailing whitespace**: "information " (with invisible trailing space from copy-paste in Sheets)

The Switch node did exact string matching, so "Information" !== "information".

## Fix

Applied normalization at the earliest ingestion point (the `makeJob from row` Code node):

```javascript
const intent = (row.intent_type || '').toLowerCase().trim();
```

Also added a `canonIntent()` function that maps all variations to canonical values:

```javascript
function canonIntent(raw) {
  const s = raw.toLowerCase().trim();
  if (/information(al)?/.test(s)) return 'information';
  if (/product[_-]?review/.test(s)) return 'product_review';
  if (/review/.test(s)) return 'review';
  if (/listicle|list|best|top/.test(s)) return 'listicle';
  if (/comparison|vs|versus/.test(s)) return 'comparisson';
  return 'information'; // safe default
}
```

## Lesson

Never trust string values from spreadsheets. Always normalize (lowercase + trim) at the ingestion boundary before any routing logic. Use a canonicalization function for fields with multiple valid representations.

## Related

- [[project-blog-writer-v5]]
- [[tool-n8n-code-patterns]]
