import { Hono } from 'hono';
import { getChangelog } from '../services/vault.js';

const changelog = new Hono();

// GET /changelog?limit=20
changelog.get('/', (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const nodes = getChangelog(limit);

  return c.json({
    count: nodes.length,
    entries: nodes.map(n => ({
      id: n.meta.id,
      type: n.meta.type,
      title: n.meta.title,
      domain: n.meta.domain,
      status: n.meta.status,
      updated: n.meta.updated,
      created: n.meta.created,
    })),
  });
});

export default changelog;
