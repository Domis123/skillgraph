import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

export interface NodeMeta {
  id: string;
  type: string;
  title: string;
  domain: string;
  tags: string[];
  status: string;
  confidence: string;
  created: string;
  updated: string;
  connections: { target: string; edge: string }[];
}

export interface VaultNode {
  meta: NodeMeta;
  content: string;      // markdown body (no frontmatter)
  raw: string;           // full file content (frontmatter + body)
  filePath: string;      // relative path in vault
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

const VAULT_DIR = path.resolve(process.env.VAULT_PATH || '../vault');

let nodesCache: Map<string, VaultNode> = new Map();
let edgesCache: GraphEdge[] = [];
let lastScan = 0;

/**
 * Scan the vault directory and build in-memory index.
 * Called on startup and can be triggered via API.
 */
export function scanVault(): { nodes: number; edges: number } {
  const files = glob.sync('**/*.md', { cwd: VAULT_DIR, absolute: false });
  const newNodes = new Map<string, VaultNode>();
  const newEdges: GraphEdge[] = [];

  for (const relPath of files) {
    const fullPath = path.join(VAULT_DIR, relPath);
    const raw = fs.readFileSync(fullPath, 'utf-8');

    let parsed;
    try {
      parsed = matter(raw);
    } catch {
      console.warn(`[vault] Failed to parse frontmatter: ${relPath}`);
      continue;
    }

    const fm = parsed.data as Record<string, any>;
    if (!fm.id || !fm.type) {
      console.warn(`[vault] Missing id or type: ${relPath}`);
      continue;
    }

    const meta: NodeMeta = {
      id: String(fm.id),
      type: String(fm.type),
      title: String(fm.title || fm.id),
      domain: String(fm.domain || 'uncategorized'),
      tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
      status: String(fm.status || 'active'),
      confidence: String(fm.confidence || 'medium'),
      created: String(fm.created || ''),
      updated: String(fm.updated || ''),
      connections: Array.isArray(fm.connections)
        ? fm.connections.map((c: any) => ({
            target: String(c.target || ''),
            edge: String(c.edge || 'related_to'),
          }))
        : [],
    };

    newNodes.set(meta.id, {
      meta,
      content: parsed.content.trim(),
      raw,
      filePath: relPath,
    });

    // Build edges from connections
    for (const conn of meta.connections) {
      if (conn.target) {
        newEdges.push({
          source: meta.id,
          target: conn.target,
          type: conn.edge,
        });
      }
    }
  }

  nodesCache = newNodes;
  edgesCache = newEdges;
  lastScan = Date.now();

  console.log(`[vault] Scanned: ${newNodes.size} nodes, ${newEdges.length} edges`);
  return { nodes: newNodes.size, edges: newEdges.length };
}

export function getNode(id: string): VaultNode | undefined {
  return nodesCache.get(id);
}

export function getAllNodes(): VaultNode[] {
  return Array.from(nodesCache.values());
}

export function getEdges(): GraphEdge[] {
  return edgesCache;
}

export function getNodeConnections(id: string): { node: VaultNode; edge: string }[] {
  const results: { node: VaultNode; edge: string }[] = [];
  for (const e of edgesCache) {
    if (e.source === id) {
      const n = nodesCache.get(e.target);
      if (n) results.push({ node: n, edge: e.type });
    } else if (e.target === id) {
      const n = nodesCache.get(e.source);
      if (n) results.push({ node: n, edge: e.type });
    }
  }
  return results;
}

export function searchNodes(query: string, filters?: {
  type?: string;
  domain?: string;
  status?: string;
  confidence?: string;
}): VaultNode[] {
  const q = query.toLowerCase();
  let results = getAllNodes();

  if (filters?.type) results = results.filter(n => n.meta.type === filters.type);
  if (filters?.domain) results = results.filter(n => n.meta.domain === filters.domain);
  if (filters?.status) results = results.filter(n => n.meta.status === filters.status);
  if (filters?.confidence) results = results.filter(n => n.meta.confidence === filters.confidence);

  if (q) {
    results = results.filter(n =>
      n.meta.title.toLowerCase().includes(q) ||
      n.meta.id.toLowerCase().includes(q) ||
      n.meta.domain.toLowerCase().includes(q) ||
      n.meta.tags.some(t => t.toLowerCase().includes(q)) ||
      n.content.toLowerCase().includes(q)
    );
  }

  // Sort: exact title match first, then by updated date
  results.sort((a, b) => {
    const aTitle = a.meta.title.toLowerCase().includes(q) ? 0 : 1;
    const bTitle = b.meta.title.toLowerCase().includes(q) ? 0 : 1;
    if (aTitle !== bTitle) return aTitle - bTitle;
    return (b.meta.updated || '').localeCompare(a.meta.updated || '');
  });

  return results;
}

export function getDomains(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodesCache.values()) {
    counts[n.meta.domain] = (counts[n.meta.domain] || 0) + 1;
  }
  return counts;
}

export function getStats() {
  const types: Record<string, number> = {};
  for (const n of nodesCache.values()) {
    types[n.meta.type] = (types[n.meta.type] || 0) + 1;
  }
  return {
    totalNodes: nodesCache.size,
    totalEdges: edgesCache.length,
    types,
    domains: getDomains(),
    lastScan: new Date(lastScan).toISOString(),
  };
}

/**
 * Write a new node to the vault as a .md file.
 * Returns the created node.
 */
export function createNode(input: {
  id: string;
  type: string;
  title: string;
  domain: string;
  tags?: string[];
  confidence?: string;
  connections?: { target: string; edge: string }[];
  content: string;
}): VaultNode {
  const now = new Date().toISOString().slice(0, 10);
  const meta: NodeMeta = {
    id: input.id,
    type: input.type,
    title: input.title,
    domain: input.domain,
    tags: input.tags || [],
    status: 'active',
    confidence: input.confidence || 'medium',
    created: now,
    updated: now,
    connections: input.connections || [],
  };

  // Build frontmatter
  const fm = {
    id: meta.id,
    type: meta.type,
    title: meta.title,
    domain: meta.domain,
    tags: meta.tags,
    status: meta.status,
    confidence: meta.confidence,
    created: meta.created,
    updated: meta.updated,
    connections: meta.connections,
  };

  const raw = matter.stringify(input.content, fm);

  // Determine file path
  const typeDir = `${meta.type}s`; // skill → skills, lesson → lessons
  const domDir = meta.domain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const fileName = meta.id.replace(/^(skill|lesson|project|tool|concept|reference)-/, '') + '.md';

  let relPath: string;
  if (['skill', 'tool'].includes(meta.type)) {
    relPath = path.join(typeDir, domDir, fileName);
  } else {
    relPath = path.join(typeDir, fileName);
  }

  const fullPath = path.join(VAULT_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, raw, 'utf-8');

  const node: VaultNode = { meta, content: input.content, raw, filePath: relPath };
  nodesCache.set(meta.id, node);

  // Rebuild edges for this node
  edgesCache = edgesCache.filter(e => e.source !== meta.id);
  for (const conn of meta.connections) {
    if (conn.target) {
      edgesCache.push({ source: meta.id, target: conn.target, type: conn.edge });
    }
  }

  return node;
}

/**
 * Add connections to an existing node (doesn't remove existing ones).
 */
export function addConnections(id: string, newConns: { target: string; edge: string }[]): VaultNode | null {
  const node = nodesCache.get(id);
  if (!node) return null;

  // Deduplicate: skip connections that already exist
  const existing = new Set(node.meta.connections.map(c => `${c.target}:${c.edge}`));
  const toAdd = newConns.filter(c => !existing.has(`${c.target}:${c.edge}`));
  if (toAdd.length === 0) return node;

  node.meta.connections.push(...toAdd);
  node.meta.updated = new Date().toISOString().slice(0, 10);

  // Rebuild file
  const fm = { ...node.meta };
  node.raw = matter.stringify(node.content, fm);

  const fullPath = path.join(VAULT_DIR, node.filePath);
  fs.writeFileSync(fullPath, node.raw, 'utf-8');

  // Update edge cache
  for (const conn of toAdd) {
    if (conn.target && getNode(conn.target)) {
      edgesCache.push({ source: id, target: conn.target, type: conn.edge });
    }
  }

  nodesCache.set(id, node);
  return node;
}

/**
 * Get recently updated nodes (changelog).
 */
export function getChangelog(limit: number = 20): VaultNode[] {
  return getAllNodes()
    .sort((a, b) => (b.meta.updated || '').localeCompare(a.meta.updated || ''))
    .slice(0, limit);
}

/**
 * Suggest connections for a new node based on keyword overlap.
 * Uses strict scoring to avoid noise connections.
 */
export function suggestConnections(input: {
  title: string;
  domain: string;
  tags: string[];
  content: string;
}): { id: string; title: string; type: string; domain: string; score: number; suggestedEdge: string }[] {
  // Common words that inflate scores without meaning
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has', 'have',
    'not', 'but', 'can', 'will', 'use', 'used', 'using', 'how', 'what', 'when', 'why',
    'n8n', 'node', 'workflow', 'content', 'system', 'data', 'should', 'each', 'also',
    'example', 'because', 'like', 'into', 'then', 'first', 'new', 'get', 'set',
    'code', 'value', 'type', 'name', 'output', 'input', 'error', 'file', 'step',
  ]);

  const inputWords = new Set(
    `${input.title} ${input.tags.join(' ')} ${input.content}`
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );

  // Extract title words separately for stronger matching
  const titleWords = new Set(
    input.title.toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );

  const scores: { id: string; title: string; type: string; domain: string; score: number; suggestedEdge: string }[] = [];

  for (const node of nodesCache.values()) {
    let score = 0;

    const nodeTitleWords = node.meta.title.toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    const nodeContentWords = node.content.toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Title-to-title overlap (strongest signal)
    for (const w of nodeTitleWords) {
      if (titleWords.has(w)) score += 4;
    }

    // Title-to-content overlap (medium signal)
    for (const w of nodeTitleWords) {
      if (inputWords.has(w) && !titleWords.has(w)) score += 2;
    }

    // Content-to-content overlap (weak signal, cap at 6)
    let contentOverlap = 0;
    for (const w of nodeContentWords) {
      if (inputWords.has(w)) contentOverlap++;
    }
    score += Math.min(contentOverlap, 6);

    // Shared tags (only specific tags, not generic ones)
    const genericTags = new Set(['n8n', 'bug', 'pipeline', 'production', 'prompt-engineering']);
    for (const t of node.meta.tags) {
      if (input.tags.includes(t) && !genericTags.has(t)) score += 3;
    }

    // Same domain: small bonus only
    if (node.meta.domain === input.domain) score += 1;

    if (score > 8) {
      let suggestedEdge = 'related_to';
      if (node.meta.type === 'project') suggestedEdge = 'part_of';
      if (node.meta.type === 'concept') suggestedEdge = 'depends_on';
      if (node.meta.type === 'tool') suggestedEdge = 'uses';

      scores.push({
        id: node.meta.id,
        title: node.meta.title,
        type: node.meta.type,
        domain: node.meta.domain,
        score,
        suggestedEdge,
      });
    }
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Archive a node: set status to archived, move file to archive/ folder.
 */
export function archiveNode(id: string): VaultNode | null {
  const node = nodesCache.get(id);
  if (!node) return null;

  // Update status
  node.meta.status = 'archived';
  node.meta.updated = new Date().toISOString().slice(0, 10);

  // Rebuild file content
  const fm = { ...node.meta };
  const raw = matter.stringify(node.content, fm);

  // Move to archive folder
  const oldPath = path.join(VAULT_DIR, node.filePath);
  const archiveName = `${node.meta.id}.md`;
  const newRelPath = path.join('archive', archiveName);
  const newFullPath = path.join(VAULT_DIR, newRelPath);

  fs.mkdirSync(path.dirname(newFullPath), { recursive: true });
  fs.writeFileSync(newFullPath, raw, 'utf-8');

  // Remove old file
  try { fs.unlinkSync(oldPath); } catch {}

  // Update cache
  node.raw = raw;
  node.filePath = newRelPath;
  nodesCache.set(id, node);

  return node;
}
