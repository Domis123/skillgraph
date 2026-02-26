import { Hono } from 'hono';
import { createNode, suggestConnections } from '../services/vault.js';
import { authMiddleware } from '../middleware/auth.js';

const webhook = new Hono();

/**
 * POST /webhook/n8n — Accept n8n webhook payloads to auto-create nodes.
 * 
 * Expected payload:
 * {
 *   "type": "lesson",
 *   "title": "My New Lesson",
 *   "domain": "n8n",
 *   "tags": ["error-handling", "webhooks"],
 *   "content": "## Context\n\nSomething happened...",
 *   "confidence": "medium",
 *   "auto_connect": true  // optional: auto-suggest and attach connections
 * }
 * 
 * n8n setup: HTTP Request node → POST to this URL with Bearer token
 */
webhook.post('/n8n', authMiddleware, async (c) => {
  const body = await c.req.json();

  if (!body.title || !body.type) {
    return c.json({ error: 'Missing required fields: title, type' }, 400);
  }

  // Generate ID from type + title
  const slug = body.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  const id = `${body.type}-${slug}`;

  let connections = body.connections || [];

  // Auto-connect if requested
  if (body.auto_connect) {
    const suggestions = suggestConnections({
      title: body.title,
      domain: body.domain || 'uncategorized',
      tags: body.tags || [],
      content: body.content || '',
    });
    // Take top 3 suggestions with score > 4
    connections = suggestions
      .filter(s => s.score > 4)
      .slice(0, 3)
      .map(s => ({ target: s.id, edge: s.suggestedEdge }));
  }

  try {
    const node = createNode({
      id,
      type: body.type,
      title: body.title,
      domain: body.domain || 'uncategorized',
      tags: body.tags || [],
      confidence: body.confidence || 'medium',
      connections,
      content: body.content || `# ${body.title}\n\n(Auto-created via n8n webhook)`,
    });

    return c.json({
      created: true,
      id: node.meta.id,
      filePath: node.filePath,
      autoConnections: connections.length,
      source: 'n8n-webhook',
    }, 201);
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to create node' }, 500);
  }
});

export default webhook;
