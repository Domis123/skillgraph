---
id: lesson-key-normalizer-strips
type: lesson
title: "Key Normalizer ensureShape() Silently Strips Unknown Fields"
domain: content-system
tags: [n8n, data-pipeline, whitelist, bug]
status: active
confidence: high
created: 2026-02-25
updated: 2026-02-25
connections:
  - target: skill-suggested-blocks-pipeline
    edge: related_to
  - target: project-blog-writer-v5
    edge: part_of
---

# Key Normalizer ensureShape() Silently Strips Unknown Fields

## What Happened

The `suggested_blocks` array was correctly added by `makeOutline` in the Brief Builder workflow, but the Writer workflow never received it. Articles showed no block suggestion lines.

## Root Cause

The `Key normalizer` node has an `ensureShape()` function that rebuilds each section object using an explicit field whitelist:

```javascript
const ensureShape = (arr) => arr.map(s => ({
  h2: asStr(s.h2),
  intro_sentences: asStr(s.intro_sentences),
  purpose: asStr(s.purpose),
  // ... other whitelisted fields ...
  h3: s.h3.map(...)
}));
```

Any field NOT in this whitelist is silently dropped. `suggested_blocks` was not in the whitelist, so it was stripped during the merge step.

## Fix

Added one line to `ensureShape()`:

```javascript
suggested_blocks: isArr(s.suggested_blocks) ? s.suggested_blocks : [],
```

## Lesson

When adding new data fields to a pipeline that passes through normalization/reshaping functions, always check every intermediate node for field whitelists. Silent data loss is the hardest bug to diagnose — the data looks correct at the source but disappears mid-pipeline.

**General rule**: Any function that rebuilds objects with explicit field mapping is a potential data-loss point for new fields.

## Related

- [[skill-suggested-blocks-pipeline]]
- [[project-blog-writer-v5]]
