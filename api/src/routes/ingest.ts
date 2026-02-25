import { Hono } from 'hono';
import { createNode, getNode } from '../services/vault.js';
import { authMiddleware } from '../middleware/auth.js';

const ingest = new Hono();

/**
 * POST /ingest — Simplified ingestion for AI agents.
 * 
 * Accepts a simpler format than POST /nodes:
 * {
 *   "type": "lesson",
 *   "title": "comparisonTable crashes CMS",
 *   "domain": "content-system",
 *   "content": "The comparisonTable block type...",
 *   "tags": ["cms", "bug"],
 *   "connections": [{ "target": "project-blog-writer-v5", "edge": "part_of" }]
 * }
 * 
 * Auto-generates ID from type + title.
 */
ingest.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();

  if (!body.type || !body.title || !body.content) {
    return c.json({ error: 'Missing required fields: type, title, content' }, 400);
  }

  // Auto-generate ID from type + title
  const slug = body.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const id = body.id || `${body.type}-${slug}`;

  // Check for duplicate
  if (getNode(id)) {
    return c.json({
      error: `Node "${id}" already exists. Use PUT /nodes/:id to update.`,
      existingId: id,
    }, 409);
  }

  const node = createNode({
    id,
    type: body.type,
    title: body.title,
    domain: body.domain || 'uncategorized',
    tags: body.tags || [],
    confidence: body.confidence || 'medium',
    connections: body.connections || [],
    content: body.content,
  });

  return c.json({
    ingested: true,
    id: node.meta.id,
    filePath: node.filePath,
    url: `/v1/nodes/${node.meta.id}/raw`,
  }, 201);
});

export default ingest;
