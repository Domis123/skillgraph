import { Hono } from 'hono';
import { suggestConnections } from '../services/vault.js';

const suggest = new Hono();

// POST /suggest — given a node draft, suggest connections
suggest.post('/', async (c) => {
  const body = await c.req.json();

  if (!body.title) {
    return c.json({ error: 'Missing required field: title' }, 400);
  }

  const suggestions = suggestConnections({
    title: body.title || '',
    domain: body.domain || '',
    tags: body.tags || [],
    content: body.content || '',
  });

  return c.json({
    count: suggestions.length,
    suggestions,
  });
});

export default suggest;
