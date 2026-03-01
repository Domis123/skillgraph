import { Hono } from 'hono';
import { getNode, getAllNodes, getNodeConnections, createNode, archiveNode, addConnections, updateNode } from '../services/vault.js';
import { suggestConnections } from '../services/vault.js';
import { authMiddleware } from '../middleware/auth.js';

const nodes = new Hono();

// GET /nodes — list all nodes (with optional filters)
nodes.get('/', (c) => {
  const all = getAllNodes();
  const type = c.req.query('type');
  const domain = c.req.query('domain');
  const status = c.req.query('status');

  let results = all;
  if (type) results = results.filter(n => n.meta.type === type);
  if (domain) results = results.filter(n => n.meta.domain === domain);
  if (status) results = results.filter(n => n.meta.status === status);

  return c.json({
    count: results.length,
    nodes: results.map(n => ({
      id: n.meta.id,
      type: n.meta.type,
      title: n.meta.title,
      domain: n.meta.domain,
      tags: n.meta.tags,
      status: n.meta.status,
      confidence: n.meta.confidence,
      updated: n.meta.updated,
      connectionCount: n.meta.connections.length,
    })),
  });
});

// GET /nodes/:id — get full node with markdown content
nodes.get('/:id', (c) => {
  const id = c.req.param('id');
  const node = getNode(id);
  if (!node) return c.json({ error: 'Node not found' }, 404);

  return c.json({
    id: node.meta.id,
    type: node.meta.type,
    title: node.meta.title,
    domain: node.meta.domain,
    tags: node.meta.tags,
    status: node.meta.status,
    confidence: node.meta.confidence,
    created: node.meta.created,
    updated: node.meta.updated,
    connections: node.meta.connections,
    content: node.content,
    filePath: node.filePath,
  });
});

// GET /nodes/:id/raw — get raw markdown file (for AI chat access)
nodes.get('/:id/raw', (c) => {
  const id = c.req.param('id');
  const node = getNode(id);
  if (!node) return c.text('Node not found', 404);

  c.header('Content-Type', 'text/markdown; charset=utf-8');
  return c.text(node.raw);
});

// GET /nodes/:id/connections — get connected nodes
nodes.get('/:id/connections', (c) => {
  const id = c.req.param('id');
  const node = getNode(id);
  if (!node) return c.json({ error: 'Node not found' }, 404);

  const conns = getNodeConnections(id);
  return c.json({
    nodeId: id,
    connections: conns.map(c => ({
      id: c.node.meta.id,
      type: c.node.meta.type,
      title: c.node.meta.title,
      domain: c.node.meta.domain,
      edge: c.edge,
    })),
  });
});

// POST /nodes — create new node (requires API key)
nodes.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();

  if (!body.id || !body.type || !body.title || !body.content) {
    return c.json({ error: 'Missing required fields: id, type, title, content' }, 400);
  }

  // Validate type
  const validTypes = ['skill', 'lesson', 'project', 'tool', 'concept', 'reference'];
  if (!validTypes.includes(body.type)) {
    return c.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, 400);
  }

  // Check for duplicate ID
  if (getNode(body.id)) {
    return c.json({ error: `Node with id "${body.id}" already exists` }, 409);
  }

  const node = createNode({
    id: body.id,
    type: body.type,
    title: body.title,
    domain: body.domain || 'uncategorized',
    tags: body.tags,
    confidence: body.confidence,
    connections: body.connections,
    content: body.content,
  });

  return c.json({
    created: true,
    id: node.meta.id,
    filePath: node.filePath,
  }, 201);
});

// PATCH /nodes/:id — update node metadata/content (requires API key)
nodes.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const node = updateNode(id, {
    title: body.title,
    domain: body.domain,
    tags: body.tags,
    confidence: body.confidence,
    content: body.content,
    connections: body.connections,
  });

  if (!node) return c.json({ error: 'Node not found' }, 404);

  return c.json({
    updated: true,
    id: node.meta.id,
    title: node.meta.title,
    domain: node.meta.domain,
    tags: node.meta.tags,
    confidence: node.meta.confidence,
    connectionCount: node.meta.connections.length,
  });
});

// PATCH /nodes/:id/connections — add connections to existing node (requires API key)
nodes.patch('/:id/connections', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.connections || !Array.isArray(body.connections)) {
    return c.json({ error: 'Missing field: connections (array of {target, edge})' }, 400);
  }

  const node = addConnections(id, body.connections);
  if (!node) return c.json({ error: 'Node not found' }, 404);

  return c.json({
    updated: true,
    id: node.meta.id,
    connectionCount: node.meta.connections.length,
  });
});

// POST /nodes/bulk-connect — connect multiple nodes at once (requires API key)
nodes.post('/bulk-connect', authMiddleware, async (c) => {
  const body = await c.req.json();

  if (!body.connections || !Array.isArray(body.connections)) {
    return c.json({ error: 'Missing field: connections (array of {source, target, edge})' }, 400);
  }

  const results: any[] = [];
  for (const conn of body.connections) {
    if (!conn.source || !conn.target || !conn.edge) continue;
    const node = addConnections(conn.source, [{ target: conn.target, edge: conn.edge }]);
    if (node) results.push({ source: conn.source, target: conn.target, edge: conn.edge, ok: true });
    else results.push({ source: conn.source, target: conn.target, error: 'source not found' });
  }

  return c.json({ processed: results.length, results });
});

// DELETE /nodes/:id — archive a node (requires API key)
nodes.delete('/:id', authMiddleware, (c) => {
  const id = c.req.param('id');
  const node = archiveNode(id);
  if (!node) return c.json({ error: 'Node not found' }, 404);

  return c.json({
    archived: true,
    id: node.meta.id,
    filePath: node.filePath,
  });
});

export default nodes;
