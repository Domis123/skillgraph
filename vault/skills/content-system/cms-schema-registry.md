---
id: skill-cms-schema-registry
type: skill
title: "CMS Schema Registry — Centralized Block Type Definitions"
domain: content-system
tags: [cms, blocks, schema, n8n, prompt-engineering]
status: active
confidence: high
created: 2026-02-20
updated: 2026-02-25
connections:
  - target: project-blog-writer-v5
    edge: part_of
  - target: concept-separation-of-concerns
    edge: depends_on
  - target: skill-block-variety-directive
    edge: related_to
  - target: skill-image-placeholder-pattern
    edge: related_to
  - target: lesson-comparison-table-crash
    edge: related_to
  - target: lesson-key-normalizer-strips
    edge: related_to
---

# CMS Schema Registry — Centralized Block Type Definitions

## Context

The blog writer pipeline uses a CMS (Payload CMS) that accepts articles as JSON with typed content blocks. Previously, each workflow (informational, review, listicle, comparison) had its own hardcoded block definitions embedded in writer prompts — totalling ~3,700 characters of duplicated schema per workflow.

When block types changed or new ones were added, every workflow needed manual updates. Bugs were common (e.g., using `comparisonTable` for text data, which the CMS rejects).

## Pattern

A single n8n Code node (`CMS Block Schema Registry`) defines ALL 24 block types in one place with:

1. **Full schema per block** — field names, types, constraints, example JSON
2. **Allowed/forbidden lists per intent type** — informational gets 11 blocks, reviews get 14
3. **Image placeholder pattern** — unified rule: write alt text, leave src empty
4. **Quick rules** — table max rows, list formatting, paragraph max sentences

The registry output is injected into the writer system prompt as a `CMS CONTENT BLOCK REFERENCE` section, replacing all hardcoded definitions.

### Allowed Blocks (Informational)

- paragraph, paragraph-with-header
- list-with-header, listicle
- image-block, image-block-responsive
- banner, cta-banner
- quotation-anonymous
- regularTable, tableSimple

### Forbidden Blocks (13 total)

cta-card, cta-product-card, highlights, pros-card, pros-and-cons-list, quotation-with-top-avatar, quotation-with-bottom-avatar, testimonials-card-small, testimonials-card-with-picture, testimonials-card-with-review, comparisonTable, featured-in

## Anti-Pattern

❌ Hardcoding block definitions inside each writer prompt. Leads to:
- Drift between workflows (one gets updated, others don't)
- ~3,700 chars wasted per prompt on duplicated schema
- AI using forbidden blocks because the list is incomplete

## Evidence

- Reduced prompt size by ~3,700 characters per workflow
- Block type diversity in articles increased from 2 types to 7 types
- Zero CMS validation failures since deployment (previously ~1 per 10 articles)

## Implementation

The registry is a single n8n Code node that returns a structured object:

```javascript
const SCHEMA = {
  blocks: { /* all 24 block definitions */ },
  allowed: {
    informational: ['paragraph', 'paragraph-with-header', ...],
    review: ['paragraph', 'paragraph-with-header', 'pros-and-cons-list', ...],
  },
  forbidden: {
    informational: ['comparisonTable', 'highlights', ...],
  }
};
```

The writer prompt builder reads from this registry and injects only the relevant blocks.

## Related

- [[project-blog-writer-v5]]
- [[concept-separation-of-concerns]]
- [[skill-block-variety-directive]]
- [[lesson-comparison-table-crash]]
