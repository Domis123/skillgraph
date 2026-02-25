---
id: project-blog-writer-v5
type: project
title: "Blog Writer v5 — Full Content Generation Pipeline"
domain: content-system
tags: [pipeline, n8n, cms, ai-generation, production]
status: active
confidence: high
created: 2025-11-01
updated: 2026-02-25
connections:
  - target: skill-cms-schema-registry
    edge: related_to
  - target: skill-block-variety-directive
    edge: related_to
  - target: skill-image-placeholder-pattern
    edge: related_to
  - target: skill-suggested-blocks-pipeline
    edge: related_to
  - target: skill-error-handling-n8n
    edge: related_to
  - target: skill-prompt-chaining
    edge: related_to
  - target: lesson-comparison-table-crash
    edge: related_to
  - target: lesson-key-normalizer-strips
    edge: related_to
  - target: lesson-s3-filename-malformation
    edge: related_to
  - target: lesson-intent-type-mismatch
    edge: related_to
---

# Blog Writer v5 — Full Content Generation Pipeline

## Overview

Automated content generation system producing SEO-optimized health and wellness articles for multiple product sites (Carnimeat, Ketoway, NordPilates, NoDiet). End-to-end pipeline from keyword to published article.

## Architecture

4 interconnected n8n workflows, ~30 nodes each:

```
[Google Sheets: Keyword Queue]
    ↓
[1. Brief & Outline Builder]
    BuildOutlinePrompt → AI → parseOutlineJSON
    → QAOutlinePrompt → AI QA → parseOutlineJSON_QA
    → makeOutline (+ suggestBlocks)
    → BuildBriefPrompt → AI → parseBriefJSON
    → Key normalizer → Output
    ↓
[2. Blog Writer]
    buildPrompt (informational/review/listicle)
    → CMS Schema Registry injection
    → AI Writer → parseArticleJSON
    → Extract Final Article → Validation
    ↓
[3. Image Generator]
    Alt Text Extractor → Unsplash Search
    → S3 Upload → Replace Placeholders
    ↓
[4. CMS Publisher]
    → Payload CMS API → Status Update
```

## Key Components

- **CMS Schema Registry**: Centralized block type definitions (see skill)
- **Block Variety Directive**: Enforces diverse block usage
- **Suggested Blocks Pipeline**: Section-level block recommendations
- **Product Integration**: Automated product placement per brief
- **Multi-intent support**: informational, review, listicle, comparison routing

## Current Metrics

- Articles per day: 5-10
- CMS validation pass rate: ~99% (up from ~90%)
- Block type diversity: 7 types average (up from 2)
- Sites supported: 4 (carnimeat, ketoway, nordpilates, nodiet)
