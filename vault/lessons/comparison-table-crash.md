---
id: lesson-comparison-table-crash
type: lesson
title: "comparisonTable Block Crashes CMS Validation"
domain: content-system
tags: [cms, blocks, validation, bug]
status: active
confidence: high
created: 2026-02-18
updated: 2026-02-20
connections:
  - target: skill-cms-schema-registry
    edge: related_to
  - target: project-blog-writer-v5
    edge: part_of
---

# comparisonTable Block Crashes CMS Validation

## What Happened

Articles using the `comparisonTable` blockType were being rejected by the CMS (Payload CMS) during publishing. The validation error was not descriptive — just a generic schema failure.

## Root Cause

The `comparisonTable` block type is designed exclusively for **visual comparison cells** containing images, ratings, or icons. It does NOT support plain text data in cells.

The AI writer was using `comparisonTable` for text-based comparisons (e.g., "Keto vs Carnivore" feature tables), which produced valid-looking JSON but failed CMS schema validation.

## Fix

Added `comparisonTable` to the forbidden blocks list in the CMS Schema Registry. All text-based comparison tables must use `regularTable` instead.

```
regularTable → for text/data comparisons (2+ columns, max 6 rows)
tableSimple → for 2-column key-value pairs
comparisonTable → FORBIDDEN for text (only for image/icon cells)
```

## Lesson

Never assume a block type supports arbitrary content based on its name. Always verify against the CMS schema. Block types that look similar ("regularTable" vs "comparisonTable") can have completely different cell type requirements.

## Related

- [[skill-cms-schema-registry]]
- [[project-blog-writer-v5]]
