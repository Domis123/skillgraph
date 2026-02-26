import { Hono } from 'hono';
import { getAllNodes, getEdges, getStats, getDomains } from '../services/vault.js';

const graph = new Hono();

// GET /graph — full graph data (nodes + edges) for dashboard
graph.get('/', (c) => {
  const allNodes = getAllNodes();
  const activeNodes = allNodes.filter(n => n.meta.status !== 'archived');
  const activeIds = new Set(activeNodes.map(n => n.meta.id));

  const nodes = activeNodes.map(n => ({
    id: n.meta.id,
    type: n.meta.type,
    title: n.meta.title,
    domain: n.meta.domain,
    tags: n.meta.tags,
    status: n.meta.status,
    confidence: n.meta.confidence,
    connectionCount: n.meta.connections.length,
    updated: n.meta.updated,
  }));

  const edges = getEdges()
    .filter(e => activeIds.has(e.source) && activeIds.has(e.target))
    .map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));

  return c.json({ nodes, edges });
});

// GET /graph/stats — summary statistics
graph.get('/stats', (c) => {
  return c.json(getStats());
});

// GET /graph/domains — domain tree
graph.get('/domains', (c) => {
  return c.json(getDomains());
});

export default graph;