---
id: concept-idempotency
type: concept
title: "Idempotency in Workflow Automation"
domain: concepts
tags: [distributed-systems, reliability, webhooks]
status: active
confidence: high
created: 2025-11-15
updated: 2026-01-20
connections:
  - target: skill-error-handling-n8n
    edge: related_to
  - target: skill-race-condition-locks
    edge: related_to
---

# Idempotency in Workflow Automation

## Definition

An operation is idempotent if executing it multiple times produces the same result as executing it once. In workflow automation, this means: if a webhook fires twice with the same payload, the system should not create duplicate results.

## Why It Matters

- Webhooks can fire multiple times (retry logic, network issues)
- n8n workflows can be manually re-executed during debugging
- Cron triggers may overlap if a previous execution hasn't finished
- API calls may timeout and retry automatically

## Implementation Patterns

1. **Deduplication key**: Hash the incoming payload and check against recent executions before processing
2. **Upsert over insert**: Use `UPDATE ... ON CONFLICT` instead of blind `INSERT`
3. **Status checks**: Before modifying, check if the target is already in the desired state
4. **Distributed locks**: Redis SETNX prevents concurrent processing of the same resource

## In Our Systems

- **Blog Writer**: Article status column prevents re-processing published articles
- **Bot Farm**: Redis locks prevent two workflows from controlling the same profile
- **Comment Moderator**: Comment ID tracking prevents double-deletion
