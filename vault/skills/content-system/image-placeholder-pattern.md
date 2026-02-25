---
id: skill-image-placeholder-pattern
type: skill
title: "Image Placeholder Pattern — Unified AI-to-Image-Generator Handoff"
domain: content-system
tags: [images, cms, alt-text, pipeline]
status: active
confidence: high
created: 2026-02-18
updated: 2026-02-24
connections:
  - target: skill-cms-schema-registry
    edge: related_to
  - target: project-blog-writer-v5
    edge: part_of
  - target: lesson-s3-filename-malformation
    edge: related_to
---

# Image Placeholder Pattern — Unified AI-to-Image-Generator Handoff

## Context

The blog pipeline has two stages for images: (1) AI writer decides WHERE images go and writes alt text, (2) Image Generator pipeline sources actual images from Unsplash/S3. These stages need a clean handoff contract.

## Pattern

The AI writer follows one universal rule for ALL image-containing blocks:

- **Write descriptive alt text**: 2-3 words, lowercase, photographable real scene
- **Leave src/imageUrl as empty string** `""`
- **Image Generator fills URLs** based on alt text search

### Alt Text Rules for Meat/Diet Articles

Formula: `[cooking method] + [specific meat cut]`

✅ Good: "grilled ribeye steak", "raw beef cuts", "seared strip steak", "crispy bacon strips"
❌ Bad: "carnimeat plate" (returns desserts), "meat plate" (too generic), "fresh carnivore" (not photographable)

### Block Types Using This Pattern

| Block | Image Field | Alt Field |
|-------|-----------|----------|
| image-block | imageUrl: "" | altText: "text" |
| image-block-responsive | imageUrl: "" | altText: "text" |
| quotation-with-top-avatar | avatar.src: "" | avatar.alt: "text" |
| testimonials-card-with-picture | src: "" | alt: "text" |
| featured-in | logos[].src: "" | logos[].alt: "text" |
| comparisonTable | cells[].imageUrl: "" | cells[].alt: "text" |

## Anti-Pattern

❌ AI writing actual image URLs (they'll be broken or hallucinated)
❌ Using generic alt text like "image" or "photo" (Image Generator can't search)
❌ Alt text describing app screens or UI (Unsplash doesn't have these)

## Related

- [[skill-cms-schema-registry]]
- [[project-blog-writer-v5]]
- [[lesson-s3-filename-malformation]]
