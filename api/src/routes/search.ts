import { Hono } from 'hono';
import { searchNodes } from '../services/vault.js';

const search = new Hono();

// GET /search?q=...&type=...&domain=...
search.get('/', (c) => {
  const q = c.req.query('q') || '';
  const type = c.req.query('type');
  const domain = c.req.query('domain');
  const status = c.req.query('status');
  const confidence = c.req.query('confidence');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  const results = searchNodes(q, {
    type: type || undefined,
    domain: domain || undefined,
    status: status || undefined,
    confidence: confidence || undefined,
  }).slice(0, limit);

  return c.json({
    query: q,
    count: results.length,
    results: results.map(n => ({
      id: n.meta.id,
      type: n.meta.type,
      title: n.meta.title,
      domain: n.meta.domain,
      tags: n.meta.tags,
      confidence: n.meta.confidence,
      updated: n.meta.updated,
      // Include first 200 chars of content as snippet
      snippet: n.content.slice(0, 200).replace(/\n/g, ' ').trim(),
    })),
  });
});

export default search;
