---
id: skill-suggested-blocks-pipeline
type: skill
title: "Suggested Blocks Pipeline — Rule-Based Block Recommendations per Section"
domain: content-system
tags: [blocks, brief-builder, regex, pipeline]
status: active
confidence: high
created: 2026-02-25
updated: 2026-02-25
connections:
  - target: skill-block-variety-directive
    edge: depends_on
  - target: project-blog-writer-v5
    edge: part_of
  - target: lesson-key-normalizer-strips
    edge: related_to
---

# Suggested Blocks Pipeline — Rule-Based Block Recommendations per Section

## Context

The Block Variety Directive ensures minimum diversity (1 list + 1 table + images), but doesn't guide WHICH sections should use WHICH blocks. The AI makes conservative choices. We needed section-level block suggestions without adding AI cost or latency.

## Pattern

A `suggestBlocks()` function in the `makeOutline` node (Brief Builder workflow) scans each section's H2/H3 content with regex patterns and suggests appropriate block types:

| Content Signal | Suggested Block |
|---------------|----------------|
| comparisons, vs, versus, pricing, nutritional | regularTable |
| tips, steps, benefits, signs, ingredients | list-with-header |
| every non-FAQ, non-intro section | image-block |
| expert, research, study, evidence, findings | quotation-anonymous |
| safety, warning, caution, danger, seek care | banner |
| product name, app name, track, tool | cta-banner |

### Data Flow

```
makeOutline (adds suggested_blocks array)
  → Brief Builder AI (augments outline)
    → parseBriefJSON → Key normalizer (must preserve suggested_blocks!)
      → Writer workflow → sectionToText() renders suggestion line
```

### Critical Fix: Key normalizer

The `ensureShape()` function in Key normalizer uses a field whitelist. `suggested_blocks` was silently dropped until explicitly added:

```javascript
suggested_blocks: isArr(s.suggested_blocks) ? s.suggested_blocks : [],
```

### Writer Rendering

`sectionToText()` adds a hint line after the H2 heading:

```
## Safety Considerations
...intro text...
Suggested blocks for this section: list-with-header, image-block, banner
```

## Anti-Pattern

❌ Using AI to suggest blocks (adds cost + latency)
❌ Making suggestions mandatory (writer should have flexibility)
❌ Forgetting to update field whitelists when adding new data to the pipeline

## Evidence

After deployment: articles now consistently use 7 block types including banner and cta-banner, up from 5 with directive alone.

## Related

- [[skill-block-variety-directive]]
- [[project-blog-writer-v5]]
- [[lesson-key-normalizer-strips]]
