import { Hono } from 'hono';
import { createNode, getNode, suggestConnections, addConnections } from '../services/vault.js';
import { authMiddleware } from '../middleware/auth.js';

const ingest = new Hono();

/**
 * POST /ingest — Simplified ingestion for AI agents.
 * Auto-generates ID from type + title.
 * Auto-suggests and attaches connections unless auto_connect: false.
 */
ingest.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();

  if (!body.type || !body.title || !body.content) {
    return c.json({ error: 'Missing required fields: type, title, content' }, 400);
  }

  const slug = body.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const id = body.id || `${body.type}-${slug}`;

  if (getNode(id)) {
    return c.json({
      error: `Node "${id}" already exists. Use PATCH /nodes/:id/connections to add connections.`,
      existingId: id,
    }, 409);
  }

  const explicitConns = body.connections || [];

  let autoConns: { target: string; edge: string }[] = [];
  if (body.auto_connect !== false) {
    const suggestions = suggestConnections({
      title: body.title,
      domain: body.domain || 'uncategorized',
      tags: body.tags || [],
      content: body.content,
    });
    autoConns = suggestions
      .filter(s => s.score > 3)
      .slice(0, 5)
      .map(s => ({ target: s.id, edge: s.suggestedEdge }));
  }

  const connTargets = new Set(explicitConns.map((c: any) => c.target));
  const allConns = [
    ...explicitConns,
    ...autoConns.filter(c => !connTargets.has(c.target)),
  ];

  const node = createNode({
    id,
    type: body.type,
    title: body.title,
    domain: body.domain || 'uncategorized',
    tags: body.tags || [],
    confidence: body.confidence || 'medium',
    connections: allConns,
    content: body.content,
  });

  let reverseCount = 0;
  for (const conn of allConns) {
    const reverseEdge = conn.edge === 'part_of' ? 'contains'
      : conn.edge === 'uses' ? 'used_by'
      : conn.edge === 'depends_on' ? 'enables'
      : 'related_to';
    const updated = addConnections(conn.target, [{ target: id, edge: reverseEdge }]);
    if (updated) reverseCount++;
  }

  return c.json({
    ingested: true,
    id: node.meta.id,
    filePath: node.filePath,
    url: `/v1/nodes/${node.meta.id}/raw`,
    connections: allConns.length,
    autoConnected: autoConns.length,
    reverseLinked: reverseCount,
  }, 201);
});

export default ingest;
