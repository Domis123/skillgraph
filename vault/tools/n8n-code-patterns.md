---
id: tool-n8n-code-patterns
type: tool
title: "n8n Code Node JavaScript Patterns"
domain: n8n
tags: [javascript, code-node, patterns]
status: active
confidence: high
created: 2025-12-01
updated: 2026-02-20
connections:
  - target: skill-error-handling-n8n
    edge: related_to
  - target: lesson-intent-type-mismatch
    edge: related_to
---

# n8n Code Node JavaScript Patterns

## Essential Patterns

### Accessing Items
```javascript
// Current items
const items = $input.all();

// Items from specific node
const rows = $items('Google Sheets');

// Single item fields
const value = $json.fieldName;
```

### Workflow Static Data (Persistent State)
```javascript
const store = $getWorkflowStaticData('global');
store.lastRunTime = new Date().toISOString();
store.counter = (store.counter || 0) + 1;
```

### Safe JSON Parsing
```javascript
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}$/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Invalid JSON");
  }
}
```

### String Helpers
```javascript
const asStr = (s, d='') => (typeof s === 'string' && s.trim() !== '') ? s.trim() : d;
const lc = (x) => String(x || '').toLowerCase();
const isArr = Array.isArray;
```

### Safe Item Access from Other Nodes
```javascript
function safeItems(name) {
  try { return $items(name) || []; }
  catch { return []; }
}
```

## Anti-Patterns

❌ Using `$node["Name"].json` — breaks if node is renamed
❌ Not handling empty/undefined fields from Google Sheets
❌ Forgetting that Code nodes run once per item unless in "Run Once for All Items" mode
