'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { GraphData, NodeMeta, GraphEdge, NodeFull } from '@/lib/api';

// ═══════════════════════════════════════════════
//  THE MONOLITH — SKILLGRAPH DASHBOARD
// ═══════════════════════════════════════════════

const A = '#ff6600';
const BG = '#050505';
const FG = '#e0e0e0';
const BR = '#333';
const GR = '#1a1a1a';
const DM = '#666';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://skillgraph-production.up.railway.app';

const TM: Record<string, { t: string; c: string }> = {
  skill:     { t: 'SKILL',     c: A },
  lesson:    { t: 'LESSON',    c: '#ff3333' },
  project:   { t: 'PROJECT',   c: '#00ccff' },
  tool:      { t: 'TOOL',      c: '#33ff66' },
  concept:   { t: 'CONCEPT',   c: '#cc66ff' },
  reference: { t: 'REFERENCE', c: '#999' },
};

const EM: Record<string, string> = {
  depends_on: 'DEPENDS',
  part_of: 'PART_OF',
  related_to: 'RELATED',
  uses: 'USES',
  supersedes: 'SUPERSEDES',
};

// ── Force Layout ──
function useForce(
  nodes: NodeMeta[],
  edges: GraphEdge[],
  w: number,
  h: number
) {
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const pr = useRef<Record<string, { x: number; y: number }>>({});
  const vr = useRef<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const p: Record<string, { x: number; y: number }> = {};
    const v: Record<string, { x: number; y: number }> = {};
    const ds = [...new Set(nodes.map((n) => n.domain))];
    const da: Record<string, number> = {};
    ds.forEach((d, i) => {
      da[d] = (i / ds.length) * Math.PI * 2;
    });

    nodes.forEach((n) => {
      const a = da[n.domain] + (Math.random() - 0.5) * 0.6;
      const r = 90 + Math.random() * 200;
      p[n.id] = { x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r };
      v[n.id] = { x: 0, y: 0 };
    });
    pr.current = p;
    vr.current = v;

    let i = 0;
    const tick = () => {
      if (i++ > 400) return;
      const pp = pr.current;
      const vv = vr.current;

      nodes.forEach((n) => {
        let fx = 0, fy = 0;
        nodes.forEach((m) => {
          if (n.id === m.id) return;
          const dx = pp[n.id].x - pp[m.id].x;
          const dy = pp[n.id].y - pp[m.id].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          fx += (dx / dist) * (15000 / (dist * dist));
          fy += (dy / dist) * (15000 / (dist * dist));
        });
        edges.forEach((e) => {
          const o = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
          if (o && pp[o]) {
            fx += (pp[o].x - pp[n.id].x) * 0.012;
            fy += (pp[o].y - pp[n.id].y) * 0.012;
          }
        });
        fx += (w / 2 - pp[n.id].x) * 0.004;
        fy += (h / 2 - pp[n.id].y) * 0.004;
        vv[n.id].x = (vv[n.id].x + fx) * 0.8;
        vv[n.id].y = (vv[n.id].y + fy) * 0.8;
      });

      nodes.forEach((n) => {
        pp[n.id].x = Math.max(110, Math.min(w - 110, pp[n.id].x + vv[n.id].x));
        pp[n.id].y = Math.max(40, Math.min(h - 40, pp[n.id].y + vv[n.id].y));
      });

      pr.current = { ...pp };
      if (i % 5 === 0 || i >= 400) setPos({ ...pp });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [nodes, edges, w, h]);

  return pos;
}

// ── Edge Component ──
function MEdge({
  x1, y1, x2, y2, active, dim, edgeType,
}: {
  x1: number; y1: number; x2: number; y2: number;
  active: boolean; dim: boolean; edgeType: string;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx) * (180 / Math.PI);
  const dashed = edgeType === 'related_to';
  const col = active ? A : BR;

  return (
    <div style={{
      position: 'absolute', left: x1, top: y1, width: len, height: 2,
      background: `repeating-linear-gradient(90deg,${col} 0px,${col} ${dashed ? 4 : 8}px,transparent ${dashed ? 4 : 8}px,transparent ${dashed ? 8 : 12}px)`,
      transform: `rotate(${ang}deg)`, transformOrigin: '0 0',
      opacity: dim ? 0.06 : 1, zIndex: 0,
      animation: active ? 'march 0.8s linear infinite' : 'none',
    }} />
  );
}

// ── Node Component ──
function MNode({
  node, isSel, dim, onClick, x, y,
}: {
  node: NodeMeta; isSel: boolean; dim: boolean;
  onClick: (n: NodeMeta) => void; x: number; y: number;
}) {
  const [hov, setHov] = useState(false);
  const inv = isSel || hov;
  const tm = TM[node.type] || TM.reference;
  const conns = node.connectionCount || 0;

  return (
    <div
      onClick={() => onClick(node)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute', left: x - 94, top: y - 30, width: 188,
        padding: '10px 14px', cursor: 'pointer',
        border: `3px solid ${isSel ? A : hov ? A : dim ? GR : BR}`,
        background: inv ? FG : BG, color: inv ? BG : FG,
        boxShadow: inv ? `5px 5px 0 ${A}` : `4px 4px 0 #000`,
        opacity: dim ? 0.1 : 1, zIndex: isSel ? 50 : hov ? 40 : 1,
        fontFamily: "'JetBrains Mono', monospace",
        transform: hov && !isSel ? 'translate(-2px,-2px)' : 'none',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, letterSpacing: '0.08em', marginBottom: 5,
        color: inv ? BG : DM,
      }}>
        <span style={{ color: inv ? BG : tm.c, fontWeight: 700 }}>{tm.t}</span>
        <span>{node.id.slice(0, 12).toUpperCase()}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>
        {node.title.length > 28 ? node.title.slice(0, 28) + '…' : node.title}
      </div>
      <div style={{
        marginTop: 7, paddingTop: 6,
        borderTop: `1px solid ${inv ? 'rgba(5,5,5,0.25)' : '#222'}`,
        fontSize: 9, color: inv ? BG : DM, display: 'flex', gap: 10,
      }}>
        <span>{node.confidence.toUpperCase()}</span>
        <span>CON:{conns}</span>
        <span>{node.domain}</span>
      </div>
    </div>
  );
}

// ── Inspector ──
function Inspector({
  node, detail, loading, onClose, onNav,
}: {
  node: NodeMeta | null;
  detail: NodeFull | null;
  loading: boolean;
  onClose: () => void;
  onNav: (id: string) => void;
}) {
  if (!node) return (
    <div style={{ color: DM, fontSize: 11 }}>
      <div style={{ marginBottom: 12 }}>/// AWAITING_SELECTION</div>
      <pre style={{
        border: `1px solid ${BR}`, padding: 14, background: '#0a0a0a',
        lineHeight: 1.8, whiteSpace: 'pre', fontSize: 11,
      }}>
{`+──────────────────────────────────+
│  SELECT A NODE TO INSPECT        │
│                                  │
│  [CMD+K]  Search graph           │
│  [ESC]    Deselect node          │
│  [CLICK]  Inspect node           │
│  [HOVER]  Preview connections    │
+──────────────────────────────────+`}
      </pre>
      <div style={{ marginTop: 20, borderTop: `1px solid ${GR}`, paddingTop: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
          /// SYS_STATUS
        </div>
        {[['API', 'ONLINE'], ['SOURCE', 'RAILWAY'], ['CACHE', '30s TTL']].map(([k, v]) => (
          <div key={k} style={{
            display: 'grid', gridTemplateColumns: '100px 1fr',
            borderBottom: `1px solid ${GR}`, padding: '5px 0', fontSize: 10,
          }}>
            <span style={{ color: DM }}>{k}</span>
            <span style={{ color: v === 'ONLINE' ? A : FG }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const tm = TM[node.type] || TM.reference;

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ color: tm.c, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em' }}>
          [{tm.t}]
        </span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: DM, padding: '0 4px', fontSize: 16 }}>
          x
        </span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, color: A, marginBottom: 2, lineHeight: 1.3 }}>
        {node.title}
      </div>
      <div style={{ fontSize: 10, color: DM, marginBottom: 14 }}>
        {node.id} // {node.domain}
      </div>

      {[
        ['STATUS', node.status?.toUpperCase() || 'ACTIVE', true],
        ['CONFIDENCE', node.confidence?.toUpperCase() || '-', false],
        ['DOMAIN', node.domain, false],
        ['TAGS', node.tags?.join(', ') || '-', false],
        ['UPDATED', node.updated || '-', false],
      ].map(([k, v, hl]) => (
        <div key={k as string} style={{
          display: 'grid', gridTemplateColumns: '110px 1fr',
          borderBottom: `1px solid ${GR}`, padding: '7px 0', fontSize: 11,
        }}>
          <span style={{ color: DM, fontSize: 9, letterSpacing: '0.08em' }}>{k}</span>
          <span style={{ color: hl ? A : FG, fontWeight: hl ? 700 : 400 }}>{v}</span>
        </div>
      ))}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '20px 0', color: DM, fontSize: 11 }}>/// LOADING_CONTENT...</div>
      ) : detail ? (
        <pre style={{
          border: `1px solid ${BR}`, padding: 12, margin: '14px 0',
          background: '#0a0a0a', fontSize: 11, lineHeight: 1.7, color: '#aaa',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {detail.content.slice(0, 800)}{detail.content.length > 800 ? '\n\n[...]' : ''}
        </pre>
      ) : null}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a
          href={`${API_BASE}/v1/nodes/${node.id}/raw`}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1, padding: '9px 0', border: `3px solid ${A}`,
            background: `${A}15`, color: A, fontSize: 10, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
            textAlign: 'center', textDecoration: 'none', display: 'block',
          }}
        >
          VIEW_RAW_MD
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(`${API_BASE}/v1/nodes/${node.id}/raw`)}
          style={{
            flex: 1, padding: '9px 0', border: `3px solid ${BR}`,
            background: 'transparent', color: DM, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.04em',
          }}
        >
          CP_URL
        </button>
      </div>

      {/* Connections */}
      {detail && detail.connections.length > 0 && (
        <>
          <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
            /// CONNECTIONS [{detail.connections.length}]
          </div>
          {detail.connections.map((c, i) => (
            <div
              key={`${c.target}-${i}`}
              onClick={() => onNav(c.target)}
              style={{
                padding: '8px 10px', cursor: 'pointer',
                borderBottom: `1px solid ${GR}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = FG;
                e.currentTarget.style.color = BG;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = FG;
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{c.target}</div>
                <div style={{ fontSize: 9, color: 'inherit', opacity: 0.5 }}>
                  {EM[c.edge] || c.edge}
                </div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'inherit' }}>→</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Search Modal ──
function SearchModal({
  query, setQuery, results, loading, onSelect, onClose,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: { id: string; type: string; title: string; domain: string; snippet: string }[];
  loading: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        zIndex: 500, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', paddingTop: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, border: `3px solid ${BR}`, background: BG, boxShadow: `6px 6px 0 ${A}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '12px 16px', borderBottom: `3px solid ${BR}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: A, fontWeight: 700, fontSize: 12 }}>QUERY&gt;</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search nodes..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: FG, fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <span style={{ color: A, animation: 'cursor-blink 1s steps(1) infinite' }}>_</span>
          <span style={{ fontSize: 9, color: DM, border: `1px solid ${BR}`, padding: '2px 6px' }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: DM, fontSize: 11 }}>/// SEARCHING...</div>
          )}
          {!loading && results.length === 0 && query && (
            <div style={{ padding: 24, textAlign: 'center', color: DM, fontSize: 11 }}>/// ZERO_RESULTS</div>
          )}
          {results.map((r) => {
            const tm = TM[r.type] || TM.reference;
            return (
              <div
                key={r.id}
                onClick={() => onSelect(r.id)}
                style={{
                  padding: '10px 16px', cursor: 'pointer',
                  borderBottom: `1px solid ${GR}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = FG;
                  e.currentTarget.style.color = BG;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = FG;
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.title}</div>
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2 }}>
                    {r.domain} // {r.id}
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 12 }}>[{tm.t}]</span>
              </div>
            );
          })}
        </div>
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${GR}`,
          fontSize: 9, color: DM, display: 'flex', gap: 16,
        }}>
          <span>{results.length} found</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════════════

interface DashboardProps {
  graphData: GraphData;
  stats: {
    totalNodes: number;
    totalEdges: number;
    types: Record<string, number>;
    domains: Record<string, number>;
  };
}

export function Dashboard({ graphData, stats }: DashboardProps) {
  const { nodes, edges } = graphData;

  const [selId, setSelId] = useState<string | null>(null);
  const [hovId, setHovId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NodeFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [expandedDoms, setExpandedDoms] = useState<Record<string, boolean>>({});

  const selNode = useMemo(() => nodes.find((n) => n.id === selId) || null, [nodes, selId]);
  const hovNode = useMemo(() => nodes.find((n) => n.id === hovId) || null, [nodes, hovId]);

  const GW = 820, GH = 700;
  const pos = useForce(nodes, edges, GW, GH);
  const hasPos = Object.keys(pos).length > 0;

  // Connected node IDs for highlighting
  const connIds = useMemo(() => {
    const target = selId || hovId;
    if (!target) return new Set<string>();
    const s = new Set<string>([target]);
    edges.forEach((e) => {
      if (e.source === target) s.add(e.target);
      if (e.target === target) s.add(e.source);
    });
    return s;
  }, [selId, hovId, edges]);

  // Filtered node IDs
  const filtIds = useMemo(() => {
    if (!filterType) return new Set(nodes.map((n) => n.id));
    return new Set(nodes.filter((n) => n.type === filterType).map((n) => n.id));
  }, [filterType, nodes]);

  // Domains grouped
  const domains = useMemo(() => {
    const m: Record<string, NodeMeta[]> = {};
    nodes.forEach((n) => {
      if (!m[n.domain]) m[n.domain] = [];
      m[n.domain].push(n);
    });
    return m;
  }, [nodes]);

  // Fetch full node detail on selection
  useEffect(() => {
    if (!selId) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`${API_BASE}/v1/nodes/${selId}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selId]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(searchQuery)}&limit=12`)
        .then((r) => r.json())
        .then((d) => { setSearchResults(d.results || []); setSearchLoading(false); })
        .catch(() => setSearchLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else setSelId(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [searchOpen]);

  const selectNode = useCallback((id: string) => {
    setSelId(id);
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  const handleNodeClick = useCallback((n: NodeMeta) => {
    setSelId(n.id);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', zIndex: 1 }}>
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 20px', borderBottom: `3px solid ${BR}`,
        background: `repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.02) 2px,rgba(255,255,255,0.02) 4px)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: A }}>SKILLGRAPH_V0.9</span>
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            background: A, animation: 'blink 2s steps(1) infinite',
          }} />
          <span style={{ fontSize: 10, color: DM }}>N:{stats.totalNodes}</span>
          <span style={{ fontSize: 10, color: DM }}>E:{stats.totalEdges}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {Object.entries(TM).filter(([k]) => k !== 'reference').map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFilterType(filterType === k ? null : k)}
              style={{
                padding: '4px 10px', border: `3px solid ${filterType === k ? v.c : BR}`,
                background: filterType === k ? v.c : BG,
                color: filterType === k ? BG : DM,
                fontSize: 9, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {v.t}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: BR, margin: '0 8px' }} />
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              padding: '5px 14px', border: `3px solid ${BR}`, background: BG,
              color: DM, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            SEARCH <span style={{ fontSize: 9, border: `1px solid ${BR}`, padding: '1px 5px' }}>⌘K</span>
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '240px 1fr 320px',
        height: 'calc(100vh - 48px)',
      }}>
        {/* LEFT: Domain tree */}
        <div style={{ borderRight: `3px solid ${BR}`, overflowY: 'auto' }}>
          <div style={{
            padding: '10px 14px', borderBottom: `3px solid ${BR}`,
            fontSize: 10, color: DM, fontWeight: 700, letterSpacing: '0.1em',
          }}>
            /// DOMAIN_REGISTRY
          </div>
          {Object.entries(domains).map(([dom, items]) => (
            <div key={dom} style={{ borderBottom: `1px solid ${GR}` }}>
              <div
                onClick={() => setExpandedDoms((p) => ({ ...p, [dom]: !p[dom] }))}
                style={{
                  padding: '9px 14px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = FG;
                  e.currentTarget.style.color = BG;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = FG;
                }}
              >
                <span style={{ fontSize: 9 }}>{expandedDoms[dom] ? '[-]' : '[+]'}</span>
                <span>{dom}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>
                  {items.length}
                </span>
              </div>
              {expandedDoms[dom] && (
                <div style={{ borderLeft: `3px solid ${A}`, background: '#0a0a0a' }}>
                  {items.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setSelId(n.id)}
                      style={{
                        padding: '7px 14px 7px 28px', cursor: 'pointer', fontSize: 10,
                        borderBottom: `1px dotted ${GR}`,
                        color: selId === n.id ? A : FG,
                      }}
                      onMouseEnter={(e) => {
                        if (selId !== n.id) {
                          e.currentTarget.style.background = `${A}12`;
                          e.currentTarget.style.color = A;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = selId === n.id ? A : FG;
                      }}
                    >
                      {n.title.toLowerCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ padding: '14px', borderTop: `1px solid ${GR}`, fontSize: 9, color: DM, lineHeight: 2 }}>
            <div>NODES: {stats.totalNodes} ACTIVE</div>
            <div>EDGES: {stats.totalEdges}</div>
            <div>DOMAINS: {Object.keys(domains).length}</div>
          </div>
        </div>

        {/* CENTER: Graph */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRight: `3px solid ${BR}` }}>
          {hasPos && edges.map((e, i) => {
            const sp = pos[e.source], tp = pos[e.target];
            if (!sp || !tp) return null;
            if (filterType && (!filtIds.has(e.source) || !filtIds.has(e.target))) return null;
            const active = connIds.has(e.source) && connIds.has(e.target);
            const dim = (selId || hovId) ? !active : false;
            return (
              <MEdge
                key={i} x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                active={active} dim={dim} edgeType={e.type}
              />
            );
          })}
          {hasPos && nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            if (filterType && !filtIds.has(n.id)) return null;
            const isSel = selId === n.id;
            const isHL = connIds.has(n.id);
            const dim = (selId || hovId) ? !isHL && !isSel : false;
            return (
              <div
                key={n.id}
                onMouseEnter={() => !selId && setHovId(n.id)}
                onMouseLeave={() => setHovId(null)}
              >
                <MNode node={n} isSel={isSel} dim={dim} onClick={handleNodeClick} x={p.x} y={p.y} />
              </div>
            );
          })}
        </div>

        {/* RIGHT: Inspector */}
        <div style={{ overflowY: 'auto' }}>
          <div style={{
            padding: '10px 14px', borderBottom: `3px solid ${BR}`,
            fontSize: 10, color: DM, fontWeight: 700, letterSpacing: '0.1em',
          }}>
            /// DATA_INSPECTOR
          </div>
          <div style={{ padding: 16 }}>
            <Inspector
              node={selNode}
              detail={detail}
              loading={detailLoading}
              onClose={() => setSelId(null)}
              onNav={selectNode}
            />
          </div>
        </div>
      </div>

      {/* ── SEARCH MODAL ── */}
      {searchOpen && (
        <SearchModal
          query={searchQuery}
          setQuery={setSearchQuery}
          results={searchResults}
          loading={searchLoading}
          onSelect={selectNode}
          onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
        />
      )}
    </div>
  );
}
