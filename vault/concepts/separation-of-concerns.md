---
id: concept-separation-of-concerns
type: concept
title: "Separation of Concerns in System Design"
domain: concepts
tags: [architecture, modularity, design-principles]
status: active
confidence: high
created: 2025-11-15
updated: 2026-02-20
connections:
  - target: skill-cms-schema-registry
    edge: related_to
  - target: project-blog-writer-v5
    edge: related_to
---

# Separation of Concerns in System Design

## Definition

Each module, node, or component should handle exactly one responsibility. When responsibilities are mixed, changes to one concern risk breaking another.

## Applied In Our Systems

### CMS Schema Registry
- **Before**: Block definitions mixed into writer prompts (schema + writing instructions in same string)
- **After**: Registry defines blocks, writer prompt focuses on writing rules. Changes to blocks don't touch writing logic.

### Brief Builder Pipeline
- **Outline generation** (AI) separate from **outline normalization** (Code node) separate from **brief augmentation** (AI)
- Each stage has a single parseable output format

### Comment Moderation
- **Scoring** (keyword matching) separate from **verification** (AI sentiment check) separate from **deletion** (Facebook API calls)
- Can change scoring algorithm without touching deletion logic

## Anti-Pattern

❌ "God nodes" in n8n that do parsing + transformation + API calls + error handling in a single Code node. These become unmaintainable and impossible to debug when they fail.
