---
id: lesson-s3-filename-malformation
type: lesson
title: "S3 Filename Malformation in Image Pipeline"
domain: n8n
tags: [s3, images, sanitization, bug]
status: active
confidence: high
created: 2026-02-15
updated: 2026-02-18
connections:
  - target: project-blog-writer-v5
    edge: part_of
  - target: skill-image-placeholder-pattern
    edge: related_to
---

# S3 Filename Malformation in Image Pipeline

## What Happened

Published articles had broken image URLs. The S3 bucket contained files with malformed names like `grilled-ribeye-steak.jpg.jpg` or names with spaces and special characters.

## Root Cause

The Image Generator pipeline constructed filenames from alt text without proper sanitization:
1. Alt text "grilled ribeye steak" → filename had spaces
2. Extension was appended without checking if one already existed → double extensions
3. No URL encoding for special characters

## Fix

Added regex sanitization before S3 upload:

```javascript
function sanitizeFilename(altText, ext = '.jpg') {
  let name = altText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
    .replace(/-{2,}/g, '-');        // Collapse multiple hyphens
  
  // Remove existing extension if present
  name = name.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  
  return `${name}${ext}`;
}
```

## Lesson

Always sanitize user/AI-generated strings before using them as filenames. The sanitization function should be applied at the single point where filenames are constructed, not scattered across nodes.

## Related

- [[project-blog-writer-v5]]
- [[skill-image-placeholder-pattern]]
