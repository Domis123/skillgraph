import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { scanVault, getStats, getAllNodes } from './services/vault.js';
import nodes from './routes/nodes.js';
import search from './routes/search.js';
import graph from './routes/graph.js';
import ingest from './routes/ingest.js';
import changelog from './routes/changelog.js';
import suggest from './routes/suggest.js';
import webhook from './routes/webhook.js';

const app = new Hono();

// ── Middleware ──
app.use('*', cors({
  origin: '*',  // Lock down to your domain in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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
app.route('/v1/changelog', changelog);
app.route('/v1/suggest', suggest);
app.route('/v1/webhook', webhook);

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

// ── Fix tags (one-time repair) ──
app.post('/v1/fix-tags', (c) => {
  const all = getAllNodes();
  let fixed = 0;
  for (const node of all) {
    let needsFix = false;
    // Check if tags is a string
    if (typeof node.meta.tags === 'string' || (Array.isArray(node.meta.tags) && node.meta.tags.some(t => typeof t !== 'string'))) {
      needsFix = true;
    }
    // Also check the raw file for string-formatted tags
    if (node.raw.includes("tags: '[") || node.raw.includes('tags: "[') || node.raw.includes("tags: >-")) {
      needsFix = true;
    }
    
    if (needsFix || true) { // Fix all to be safe
      // Normalize tags
      let tags: string[] = [];
      if (Array.isArray(node.meta.tags)) {
        tags = node.meta.tags.map(String).map(t => t.replace(/^\[|\]$/g, '').trim()).filter(Boolean);
        // Handle case where array has one element like "[pipeline, n8n, cms]"
        if (tags.length === 1 && tags[0].includes(',')) {
          tags = tags[0].split(',').map(t => t.trim()).filter(Boolean);
        }
      } else if (typeof node.meta.tags === 'string') {
        tags = (node.meta.tags as string).replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
      }
      
      node.meta.tags = tags;
      
      // Rewrite file
      const fm = {
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
      };
      const matter = require('gray-matter');
      node.raw = matter.stringify(node.content, fm);
      
      const fullPath = require('path').join(process.env.VAULT_PATH || '../vault', node.filePath);
      require('fs').writeFileSync(fullPath, node.raw, 'utf-8');
      fixed++;
    }
  }
  
  // Rescan to rebuild cache
  const result = scanVault();
  return c.json({ fixed, ...result });
});

// ── Startup ──
console.log('[skillgraph] Scanning vault...');
scanVault();

const port = parseInt(process.env.PORT || '3456');
console.log(`[skillgraph] API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
