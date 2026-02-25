---
id: skill-block-variety-directive
type: skill
title: "Block Variety Directive — Forcing AI to Use Diverse Content Blocks"
domain: content-system
tags: [cms, blocks, prompt-engineering, ai-behavior]
status: active
confidence: high
created: 2026-02-22
updated: 2026-02-25
connections:
  - target: skill-cms-schema-registry
    edge: depends_on
  - target: project-blog-writer-v5
    edge: part_of
  - target: skill-suggested-blocks-pipeline
    edge: related_to
---

# Block Variety Directive — Forcing AI to Use Diverse Content Blocks

## Context

Even with the CMS Schema Registry providing all 11 allowed block types, the AI writer defaulted to using only `paragraph` and `paragraph-with-header` blocks. Articles were technically valid but visually monotonous — no tables, no lists, no banners.

## Pattern

A mandatory directive injected into the writer system prompt that enforces minimum block diversity:

```
BLOCK VARIETY REQUIREMENTS (MANDATORY)

REQUIRED (every article must include ALL of these):
- paragraph and paragraph-with-header (main content)
- At least 1 list block (list-with-header or listicle)
- At least 1 table block (regularTable or tableSimple)
- At least 1 image-block (placed mid-section)

ENCOURAGED (include 1-2 when relevant):
- quotation-anonymous — for expert insight
- banner — for standout takeaway
- cta-banner — for product CTA

SELF-CHECK: Before outputting, count your block types.
```

Combined with a checklist line: `☐ BLOCK VARIETY: Uses at least 1 list, 1 table, and 1 image`

## Anti-Pattern

❌ Relying on the AI to spontaneously use diverse blocks just because they're available in the schema. Without explicit requirements, AI defaults to the safest/simplest blocks.

## Evidence

Block diversity progression across test articles:
- Before directive: 1-2 block types (paragraph only)
- After schema + directive: 5 block types
- After schema + directive + suggested_blocks: 7 block types (paragraph, paragraph-with-header, regularTable, list-with-header, image-block, banner, cta-banner)

## Related

- [[skill-cms-schema-registry]]
- [[skill-suggested-blocks-pipeline]]
- [[project-blog-writer-v5]]
