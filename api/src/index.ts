import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { scanVault, getStats, getAllNodes } from './services/vault.js';
import nodes from './routes/nodes.js';
import search from './routes/search.js';
import graph from './routes/graph.js';
import ingest from './routes/ingest.js';

const app = new Hono();

// ── Middleware ──
app.use('*', cors({
  origin: '*',  // Lock down to your domain in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));
app.use('*', logger());

// ── Health check ──
app.get('/', (c) => {
  const stats = getStats();
  return c.json({
    service: 'skillgraph-api',
    version: '0.1.0',
    status: 'online',
    ...stats,
  });
});

app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// ── API v1 routes ──
app.route('/v1/nodes', nodes);
app.route('/v1/search', search);
app.route('/v1/graph', graph);
app.route('/v1/ingest', ingest);

// ── Static MD serving (for AI chat access via URL) ──
// GET /vault/skills/content-system/cms-schema-registry.md → raw markdown
app.get('/vault/*', (c) => {
  const reqPath = c.req.path.replace('/vault/', '');
  const all = getAllNodes();
  for (const n of all) {
    if (n.filePath === reqPath || n.filePath.endsWith(reqPath)) {
      c.header('Content-Type', 'text/markdown; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=300');
      return c.text(n.raw);
    }
  }
  return c.text('// 404: File not found in vault', 404);
});

// ── Force rescan ──
app.post('/v1/sync', (c) => {
  const result = scanVault();
  return c.json({ synced: true, ...result });
});

// ── Startup ──
console.log('[skillgraph] Scanning vault...');
scanVault();

const port = parseInt(process.env.PORT || '3456');
console.log(`[skillgraph] API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
