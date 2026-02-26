// API client for SkillGraph backend
// Uses Railway production URL, falls back to localhost for dev

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://skillgraph-production.up.railway.app';

export interface NodeMeta {
  id: string;
  type: 'skill' | 'lesson' | 'project' | 'tool' | 'concept' | 'reference';
  title: string;
  domain: string;
  tags: string[];
  status: string;
  confidence: string;
  created: string;
  updated: string;
  connectionCount: number;
}

export interface NodeFull extends NodeMeta {
  content: string;
  connections: { target: string; edge: string }[];
  filePath: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: NodeMeta[];
  edges: GraphEdge[];
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  domain: string;
  tags: string[];
  confidence: string;
  updated: string;
  snippet: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 30 }, // Cache for 30s on server
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// No-cache version for client-side refreshes
async function apiFetchFresh<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getGraphFresh(): Promise<GraphData> {
  return apiFetchFresh<GraphData>('/v1/graph');
}

export async function getStatsFresh(): Promise<{
  totalNodes: number;
  totalEdges: number;
  types: Record<string, number>;
  domains: Record<string, number>;
}> {
  return apiFetchFresh('/v1/graph/stats');
}

export async function getGraph(): Promise<GraphData> {
  return apiFetch<GraphData>('/v1/graph');
}

export async function getNode(id: string): Promise<NodeFull> {
  return apiFetch<NodeFull>(`/v1/nodes/${id}`);
}

export async function getNodeRaw(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/nodes/${id}/raw`);
  return res.text();
}

export async function searchNodes(query: string, filters?: {
  type?: string;
  domain?: string;
}): Promise<{ query: string; count: number; results: SearchResult[] }> {
  const params = new URLSearchParams({ q: query });
  if (filters?.type) params.set('type', filters.type);
  if (filters?.domain) params.set('domain', filters.domain);
  return apiFetch(`/v1/search?${params}`);
}

export async function getStats(): Promise<{
  totalNodes: number;
  totalEdges: number;
  types: Record<string, number>;
  domains: Record<string, number>;
}> {
  return apiFetch('/v1/graph/stats');
}

export async function getConnections(id: string): Promise<{
  nodeId: string;
  connections: { id: string; type: string; title: string; domain: string; edge: string }[];
}> {
  return apiFetch(`/v1/nodes/${id}/connections`);
}
