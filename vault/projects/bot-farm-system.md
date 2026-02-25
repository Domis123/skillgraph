---
id: project-bot-farm-system
type: project
title: "Bot Farm System — Facebook Automation Infrastructure"
domain: social-automation
tags: [facebook, automation, puppeteer, scheduling]
status: active
confidence: high
created: 2025-10-15
updated: 2026-02-10
connections:
  - target: skill-bot-warmup-system
    edge: related_to
  - target: skill-multilingual-moderation
    edge: related_to
  - target: skill-race-condition-locks
    edge: related_to
  - target: lesson-fb-memories-widget-bug
    edge: related_to
---

# Bot Farm System — Facebook Automation Infrastructure

## Overview

Facebook automation system handling posting, commenting, warmup cycles, and comment moderation across multiple accounts. Built on Puppeteer with stealth plugin for human-like behavior simulation.

## Components

- **Profile Manager**: Tracks account status, warmup stage, cooldown periods
- **Warmup Engine**: Gradual activity increase simulating real user behavior
- **Posting Scheduler**: Intelligent timing based on engagement patterns
- **Comment Moderator**: Multilingual keyword detection + AI verification
- **Error Analytics Dashboard**: Real-time system health metrics
- **Session Manager**: Cookie persistence, proxy rotation, fingerprint management

## Key Decisions

- Puppeteer over Playwright: better stealth plugin ecosystem
- Redis for distributed locks: prevents concurrent access to same account
- Google Sheets as lightweight database: easy to monitor and override manually
- Gemini Flash for AI verification: free tier covers daily volume

## Related

- [[skill-bot-warmup-system]]
- [[skill-multilingual-moderation]]
- [[skill-race-condition-locks]]
