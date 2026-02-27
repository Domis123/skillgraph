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

// ── Cluster Force Layout (Bubblemaps-style) ──
// Each domain gets its own gravity well. Nodes repel strongly.
// Connected nodes attract gently. Result: separated domain islands.

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
    if (nodes.length === 0 || w === 0 || h === 0) return;

    const p: Record<string, { x: number; y: number }> = {};
    const v: Record<string, { x: number; y: number }> = {};

    // Assign each domain a cluster center spread across the canvas
    const ds = [...new Set(nodes.map((n) => n.domain))];
    const clusterCenters: Record<string, { x: number; y: number }> = {};
    const margin = 250;
    const cx = w / 2, cy = h / 2;
    const clusterRadius = Math.min(w, h) * 0.32;

    ds.forEach((d, i) => {
      const angle = (i / ds.length) * Math.PI * 2 - Math.PI / 2;
      clusterCenters[d] = {
        x: cx + Math.cos(angle) * clusterRadius,
        y: cy + Math.sin(angle) * clusterRadius,
      };
    });

    // Initialize nodes near their cluster center
    nodes.forEach((n) => {
      const cc = clusterCenters[n.domain];
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 80;
      p[n.id] = { x: cc.x + Math.cos(a) * r, y: cc.y + Math.sin(a) * r };
      v[n.id] = { x: 0, y: 0 };
    });
    pr.current = p;
    vr.current = v;

    let i = 0;
    const tick = () => {
      if (i++ > 500) return;
      const pp = pr.current;
      const vv = vr.current;

      nodes.forEach((n) => {
        let fx = 0, fy = 0;

        // 1. Node-node repulsion (strong, keeps nodes apart)
        nodes.forEach((m) => {
          if (n.id === m.id) return;
          const dx = pp[n.id].x - pp[m.id].x;
          const dy = pp[n.id].y - pp[m.id].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const sameDomain = n.domain === m.domain;
          // Stronger repulsion between domains, moderate within
          const repForce = sameDomain ? 40000 : 80000;
          fx += (dx / dist) * (repForce / (dist * dist));
          fy += (dy / dist) * (repForce / (dist * dist));
        });

        // 2. Edge attraction (gentle, pulls connected nodes closer)
        edges.forEach((e) => {
          const o = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
          if (o && pp[o]) {
            const dx = pp[o].x - pp[n.id].x;
            const dy = pp[o].y - pp[n.id].y;
            // Weaker attraction for cross-domain edges
            const sameDom = nodes.find(nd => nd.id === o)?.domain === n.domain;
            const strength = sameDom ? 0.008 : 0.003;
            fx += dx * strength;
            fy += dy * strength;
          }
        });

        // 3. Domain cluster gravity (pulls nodes toward their cluster center)
        const cc = clusterCenters[n.domain];
        fx += (cc.x - pp[n.id].x) * 0.006;
        fy += (cc.y - pp[n.id].y) * 0.006;

        // 4. Very weak center gravity (prevents drift to infinity)
        fx += (cx - pp[n.id].x) * 0.0005;
        fy += (cy - pp[n.id].y) * 0.0005;

        // Damping
        vv[n.id].x = (vv[n.id].x + fx) * 0.75;
        vv[n.id].y = (vv[n.id].y + fy) * 0.75;
      });

      nodes.forEach((n) => {
        pp[n.id].x += vv[n.id].x;
        pp[n.id].y += vv[n.id].y;
      });

      pr.current = { ...pp };
      if (i % 4 === 0 || i >= 500) setPos({ ...pp });
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

// ── Node Component (variable size based on connections) ──
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

  // Scale node size by connection count
  // 0-2 connections: compact (160px)
  // 3-5: normal (190px)  
  // 6+: hub (220px)
  const nodeW = conns >= 6 ? 220 : conns >= 3 ? 190 : 160;
  const nodeH = conns >= 6 ? 'auto' : 'auto';
  const titleSize = conns >= 6 ? 13 : 12;
  const isHub = conns >= 6;

  return (
    <div
      onClick={() => onClick(node)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute', left: x - nodeW / 2, top: y - 30, width: nodeW,
        padding: isHub ? '12px 16px' : '10px 14px', cursor: 'pointer',
        border: `${isHub ? 4 : 3}px solid ${isSel ? A : hov ? A : dim ? GR : BR}`,
        background: inv ? FG : BG, color: inv ? BG : FG,
        boxShadow: inv ? `5px 5px 0 ${A}` : isHub ? `5px 5px 0 rgba(255,102,0,0.15)` : `4px 4px 0 #000`,
        opacity: dim ? 0.1 : 1, zIndex: isSel ? 50 : hov ? 40 : isHub ? 5 : 1,
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
        {isHub && <span style={{ color: inv ? BG : A, fontWeight: 700 }}>★</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.3 }}>
        {node.title.length > (isHub ? 36 : 28) ? node.title.slice(0, isHub ? 36 : 28) + '…' : node.title}
      </div>
      <div style={{
        marginTop: 7, paddingTop: 6,
        borderTop: `1px solid ${inv ? 'rgba(5,5,5,0.25)' : '#222'}`,
        fontSize: 9, color: inv ? BG : DM, display: 'flex', gap: 10,
      }}>
        <span>{conns} links</span>
        <span>{node.domain}</span>
      </div>
    </div>
  );
}

// ── Inspector ──
function Inspector({
  node, detail, loading, onClose, onNav, onArchive, onExport,
}: {
  node: NodeMeta | null;
  detail: NodeFull | null;
  loading: boolean;
  onClose: () => void;
  onNav: (id: string) => void;
  onArchive: (id: string) => void;
  onExport: (id: string) => void;
}) {
  if (!node) return (
    <div style={{ color: DM, fontSize: 11 }}>
      <div style={{ marginBottom: 12 }}>/// AWAITING_SELECTION</div>
      <pre style={{
        border: `1px solid ${BR}`, padding: 14, background: '#0a0a0a',
        lineHeight: 1.8, whiteSpace: 'pre', fontSize: 11,
      }}>
{`+──────────────────────────────────+
│  KEYBOARD SHORTCUTS              │
│                                  │
│  [CMD+K]  Search graph           │
│  [N]      New node               │
│  [TAB]    Cycle nodes            │
│  [←/→]   Walk connections        │
│  [E]      Export subgraph        │
│  [ESC]    Deselect / close       │
│  [?]      Toggle this help       │
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
        ['TAGS', Array.isArray(node.tags) ? node.tags.join(', ') : (node.tags || '-'), false],
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative', zIndex: 200 }}>
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
          VIEW_RAW
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            const url = `${API_BASE}/v1/nodes/${node.id}/raw`;
            // Fallback copy method that always works
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            const el = e.currentTarget as HTMLElement;
            el.textContent = 'COPIED!';
            el.style.color = A;
            el.style.borderColor = A;
            setTimeout(() => { el.textContent = 'CP_URL'; el.style.color = DM; el.style.borderColor = BR; }, 1500);
          }}
          style={{
            flex: 1, padding: '9px 0', border: `3px solid ${BR}`,
            background: 'transparent', color: DM, fontSize: 10, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            cursor: 'pointer',
          }}
        >
          CP_URL
        </a>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onExport(node.id); }}
          style={{
            padding: '9px 8px', border: `3px solid ${BR}`,
            background: 'transparent', color: DM, fontSize: 10, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            cursor: 'pointer',
          }}
        >
          EXP
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (window.confirm(`Archive "${node.title}"?`)) onArchive(node.id);
          }}
          style={{
            padding: '9px 8px', border: `3px solid #ff3333`,
            background: 'transparent', color: '#ff3333', fontSize: 10, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em',
            textAlign: 'center', textDecoration: 'none', display: 'block',
            cursor: 'pointer', minWidth: 50,
          }}
        >
          DEL
        </a>
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

// ── Ingest Modal (Quick Capture) ──
function IngestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('skill');
  const [domain, setDomain] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedConns, setSelectedConns] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-suggest connections when title/tags change
  useEffect(() => {
    if (title.length < 3) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`${API_BASE}/v1/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, domain, tags: tags.split(',').map(t => t.trim()).filter(Boolean), content }),
      })
        .then(r => r.json())
        .then(d => setSuggestions(d.suggestions || []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [title, domain, tags, content]);

  const toggleConn = (id: string) => {
    setSelectedConns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title required'); return; }
    setSubmitting(true);
    setError('');

    const connections = suggestions
      .filter(s => selectedConns.has(s.id))
      .map(s => ({ target: s.id, edge: s.suggestedEdge }));

    try {
      const apiKey = prompt('Enter API key:');
      if (!apiKey) { setSubmitting(false); return; }

      const res = await fetch(`${API_BASE}/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          type,
          title: title.trim(),
          domain: domain.trim() || 'uncategorized',
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          content: content.trim() || `# ${title.trim()}\n\n(Content pending)`,
          connections,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSubmitting(false); return; }
      onCreated(data.id);
    } catch (e) {
      setError('Network error');
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px',
    background: '#0a0a0a', border: `2px solid ${BR}`, color: FG,
    fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 500, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', paddingTop: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580, border: `3px solid ${BR}`, background: BG,
          boxShadow: `6px 6px 0 ${A}`, maxHeight: '80vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '12px 18px', borderBottom: `3px solid ${BR}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: A }}>+ NEW_NODE</span>
          <span onClick={onClose} style={{ cursor: 'pointer', color: DM, padding: '0 6px' }}>
            ESC
          </span>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type selector */}
          <div>
            <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>TYPE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(TM).filter(([k]) => k !== 'reference').map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  style={{
                    padding: '5px 12px', border: `2px solid ${type === k ? v.c : BR}`,
                    background: type === k ? v.c : 'transparent',
                    color: type === k ? BG : DM,
                    fontSize: 9, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {v.t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>TITLE</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Webhook Deduplication Pattern"
              style={inputStyle}
            />
          </div>

          {/* Domain + Tags row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>DOMAIN</div>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. n8n"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>TAGS (comma sep)</div>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="webhooks, dedup"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <div style={{ fontSize: 9, color: DM, letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>CONTENT (markdown, optional now)</div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="## Context&#10;&#10;Describe the pattern..."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Auto-suggested connections */}
          {suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: A, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
                /// SUGGESTED CONNECTIONS [{suggestions.length}]
              </div>
              {suggestions.map(s => {
                const sel = selectedConns.has(s.id);
                const tm = TM[s.type] || TM.reference;
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleConn(s.id)}
                    style={{
                      padding: '7px 10px', cursor: 'pointer',
                      borderBottom: `1px solid ${GR}`,
                      background: sel ? `${A}15` : 'transparent',
                      borderLeft: sel ? `3px solid ${A}` : `3px solid transparent`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{s.title.slice(0, 40)}</span>
                      <span style={{ fontSize: 9, color: DM, marginLeft: 8 }}>{s.suggestedEdge}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: tm.c }}>[{tm.t}]</span>
                      <span style={{ fontSize: 11, color: sel ? A : BR }}>{sel ? '☑' : '☐'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {error && <div style={{ color: '#ff3333', fontSize: 11 }}>ERROR: {error}</div>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '12px 0', border: `3px solid ${A}`,
              background: A, color: BG, fontSize: 12, fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.05em', opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '/// CREATING...' : 'CREATE_NODE'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Changelog Panel ──
function ChangelogPanel({
  entries,
  onSelect,
  onClose,
}: {
  entries: any[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
      background: BG, borderLeft: `3px solid ${BR}`,
      boxShadow: '-6px 0 0 rgba(255,102,0,0.1)', zIndex: 300,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: `3px solid ${BR}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: A }}>/// CHANGELOG</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: DM, fontSize: 14 }}>×</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ padding: 20, color: DM, fontSize: 11, textAlign: 'center' }}>/// NO_ENTRIES</div>
        ) : entries.map((e: any, i: number) => {
          const tm = TM[e.type] || TM.reference;
          const isNew = e.created === e.updated;
          return (
            <div
              key={`${e.id}-${i}`}
              onClick={() => onSelect(e.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                borderBottom: `1px solid ${GR}`,
                borderLeft: `3px solid ${isNew ? '#33ff66' : A}`,
              }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = `${A}10`; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: tm.c, fontWeight: 700 }}>{tm.t}</span>
                <span style={{
                  fontSize: 8, padding: '2px 6px',
                  background: isNew ? 'rgba(51,255,102,0.12)' : 'rgba(255,102,0,0.12)',
                  color: isNew ? '#33ff66' : A,
                  fontWeight: 700,
                }}>
                  {isNew ? 'NEW' : 'UPD'}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{e.title}</div>
              <div style={{ fontSize: 9, color: DM, marginTop: 4 }}>
                {e.domain} · {e.updated}
              </div>
            </div>
          );
        })}
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

export function Dashboard({ graphData, stats: initialStats }: DashboardProps) {
  // Live data state — starts with server-rendered data, can be refreshed
  const [liveGraph, setLiveGraph] = useState(graphData);
  const [liveStats, setLiveStats] = useState(initialStats);
  const { nodes, edges } = liveGraph;

  // Refresh function — fetches fresh data from API bypassing cache
  const refreshData = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([
        fetch(`${API_BASE}/v1/graph`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`${API_BASE}/v1/graph/stats`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      setLiveGraph(g);
      setLiveStats(s);
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, []);

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
  const [ingestOpen, setIngestOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogData, setChangelogData] = useState<any[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Export subgraph: selected node + connected nodes as JSON
  const exportSubgraph = useCallback(async (nodeId: string) => {
    const center = nodes.find(n => n.id === nodeId);
    if (!center) return;
    const connIds = new Set<string>([nodeId]);
    edges.forEach(e => {
      if (e.source === nodeId) connIds.add(e.target);
      if (e.target === nodeId) connIds.add(e.source);
    });
    const subNodes = nodes.filter(n => connIds.has(n.id));
    const subEdges = edges.filter(e => connIds.has(e.source) && connIds.has(e.target));

    // Fetch raw markdown for each node
    const rawNodes = await Promise.all(
      subNodes.map(async n => {
        try {
          const res = await fetch(`${API_BASE}/v1/nodes/${n.id}/raw`);
          return { id: n.id, markdown: await res.text() };
        } catch {
          return { id: n.id, markdown: '(fetch failed)' };
        }
      })
    );

    const exportData = {
      exported: new Date().toISOString(),
      center: nodeId,
      nodes: subNodes,
      edges: subEdges,
      markdownFiles: rawNodes,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skillgraph-${nodeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const selNode = useMemo(() => nodes.find((n) => n.id === selId) || null, [nodes, selId]);
  const hovNode = useMemo(() => nodes.find((n) => n.id === hovId) || null, [nodes, hovId]);

  // Responsive graph area
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setGraphSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('[data-graph-bg]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const pos = useForce(nodes, edges, graphSize.w / zoom, graphSize.h / zoom);
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
      // Don't trigger shortcuts when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIngestOpen(true);
      }
      if (e.key === 'Escape') {
        if (ingestOpen) setIngestOpen(false);
        else if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
        else setSelId(null);
      }
      // Tab: cycle through nodes
      if (e.key === 'Tab') {
        e.preventDefault();
        const ids = nodes.map(n => n.id);
        if (ids.length === 0) return;
        if (!selId) { setSelId(ids[0]); return; }
        const cur = ids.indexOf(selId);
        const next = e.shiftKey
          ? (cur - 1 + ids.length) % ids.length
          : (cur + 1) % ids.length;
        setSelId(ids[next]);
      }
      // Arrow keys: navigate connections when a node is selected
      if (selId && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const conns = edges
          .filter(ed => ed.source === selId || ed.target === selId)
          .map(ed => ed.source === selId ? ed.target : ed.source);
        if (conns.length > 0) {
          const curIdx = conns.indexOf(selId);
          setSelId(conns[(curIdx + 1) % conns.length]);
        }
      }
      if (selId && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const conns = edges
          .filter(ed => ed.source === selId || ed.target === selId)
          .map(ed => ed.source === selId ? ed.target : ed.source);
        if (conns.length > 0) {
          const curIdx = conns.indexOf(selId);
          setSelId(conns[(curIdx - 1 + conns.length) % conns.length]);
        }
      }
      // E: export selected node subgraph
      if ((e.key === 'e' || e.key === 'E') && selId) {
        e.preventDefault();
        exportSubgraph(selId);
      }
      // ?: show help
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [searchOpen, ingestOpen, selId, nodes, edges]);

  // Fetch changelog when opened
  useEffect(() => {
    if (!changelogOpen) return;
    fetch(`${API_BASE}/v1/changelog?limit=20`)
      .then(r => r.json())
      .then(d => setChangelogData(d.entries || []))
      .catch(() => {});
  }, [changelogOpen]);

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
          <span style={{ fontWeight: 800, fontSize: 15, color: A }}>SKILLGRAPH</span>
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            background: A, animation: 'blink 2s steps(1) infinite',
          }} />
          <span style={{ fontSize: 10, color: DM }}>N:{liveStats.totalNodes}</span>
          <span style={{ fontSize: 10, color: DM }}>E:{liveStats.totalEdges}</span>
        </div>

        {/* Persistent search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: `2px solid ${searchQuery ? A : BR}`,
          padding: '4px 12px', minWidth: 260,
          background: searchQuery ? '#0a0a0a' : 'transparent',
        }}>
          <span style={{ color: searchQuery ? A : DM, fontSize: 11, fontWeight: 700 }}>&gt;</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="search..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: FG, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          {searchQuery && (
            <span
              onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
              style={{ color: DM, cursor: 'pointer', fontSize: 11 }}
            >×</span>
          )}
          <span style={{ fontSize: 8, color: DM, border: `1px solid ${BR}`, padding: '1px 4px' }}>⌘K</span>
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
          <div style={{ width: 1, height: 24, background: BR, margin: '0 4px' }} />
          <button
            onClick={() => setIngestOpen(true)}
            style={{
              padding: '4px 12px', border: `3px solid ${A}`,
              background: `${A}20`, color: A,
              fontSize: 9, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            + NEW <span style={{ fontSize: 8, opacity: 0.6 }}>N</span>
          </button>
          <button
            onClick={() => setChangelogOpen(!changelogOpen)}
            style={{
              padding: '4px 12px', border: `3px solid ${changelogOpen ? A : BR}`,
              background: changelogOpen ? `${A}20` : BG,
              color: changelogOpen ? A : DM,
              fontSize: 9, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            LOG
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${leftOpen ? '240px' : '0px'} 1fr ${rightOpen ? '320px' : '0px'}`,
        height: 'calc(100vh - 48px)',
        transition: 'grid-template-columns 0.2s ease',
      }}>
        {/* LEFT: Domain tree */}
        <div style={{
          borderRight: leftOpen ? `3px solid ${BR}` : 'none',
          overflowY: 'auto', overflowX: 'hidden',
          position: 'relative', zIndex: 100,
          width: leftOpen ? 240 : 0,
          opacity: leftOpen ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}>
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
            <div>NODES: {liveStats.totalNodes} ACTIVE</div>
            <div>EDGES: {liveStats.totalEdges}</div>
            <div>DOMAINS: {Object.keys(domains).length}</div>
          </div>
        </div>

        {/* CENTER: Graph */}
        <div
          ref={graphRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          data-graph-bg
          style={{
            position: 'relative', overflow: 'hidden',
            borderRight: `3px solid ${BR}`, cursor: isPanning.current ? 'grabbing' : 'grab',
          }}
        >
          {/* Pan/Zoom container */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
          }}>
            {/* Edges */}
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
          {/* Zoom controls */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16, display: 'flex',
            flexDirection: 'column', gap: 4, zIndex: 10,
          }}>
            <button
              onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
              style={{
                width: 32, height: 32, border: `2px solid ${BR}`, background: BG,
                color: FG, fontSize: 16, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >+</button>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
              style={{
                width: 32, height: 32, border: `2px solid ${BR}`, background: BG,
                color: FG, fontSize: 16, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >−</button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{
                width: 32, height: 32, border: `2px solid ${BR}`, background: BG,
                color: DM, fontSize: 8, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >RST</button>
            <div style={{ fontSize: 8, color: DM, textAlign: 'center', marginTop: 4 }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>
          {/* Sidebar toggles */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, display: 'flex',
            gap: 4, zIndex: 10,
          }}>
            <button
              onClick={() => setLeftOpen(p => !p)}
              style={{
                width: 32, height: 32, border: `2px solid ${leftOpen ? A : BR}`, background: BG,
                color: leftOpen ? A : DM, fontSize: 10, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >{leftOpen ? '◀' : '▶'}</button>
            <button
              onClick={() => setRightOpen(p => !p)}
              style={{
                width: 32, height: 32, border: `2px solid ${rightOpen ? A : BR}`, background: BG,
                color: rightOpen ? A : DM, fontSize: 10, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >{rightOpen ? '▶' : '◀'}</button>
            <button
              onClick={() => setShowHelp(p => !p)}
              style={{
                width: 32, height: 32, border: `2px solid ${BR}`, background: BG,
                color: DM, fontSize: 14, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >?</button>
          </div>
          {/* Help overlay */}
          {showHelp && (
            <div style={{
              position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
              border: `3px solid ${A}`, background: BG, padding: 20,
              boxShadow: `6px 6px 0 ${A}`, zIndex: 200, minWidth: 300,
            }}>
              <div style={{ fontWeight: 800, color: A, fontSize: 12, marginBottom: 12 }}>/// SHORTCUTS</div>
              <pre style={{ fontSize: 11, lineHeight: 2, color: FG }}>
{`⌘K     Search
N      New node
TAB    Cycle nodes
←/→    Walk connections
E      Export subgraph
?      This help
ESC    Close / deselect`}
              </pre>
              <div onClick={() => setShowHelp(false)} style={{
                marginTop: 12, textAlign: 'center', color: DM, fontSize: 9, cursor: 'pointer',
              }}>click or press ? to close</div>
            </div>
          )}
        </div>

        {/* RIGHT: Inspector */}
        <div style={{
          overflowY: 'auto', position: 'relative', zIndex: 100,
          width: rightOpen ? 320 : 0,
          opacity: rightOpen ? 1 : 0,
          overflowX: 'hidden',
          transition: 'opacity 0.2s ease',
        }}>
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
              onArchive={async (id) => {
                const apiKey = prompt('Enter API key to archive:');
                if (!apiKey) return;
                try {
                  const res = await fetch(`${API_BASE}/v1/nodes/${id}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) {
                    setSelId(null);
                    await refreshData();
                  } else {
                    alert(`Archive failed: ${d.error || res.status}`);
                  }
                } catch (err) {
                  alert(`Network error: ${err}`);
                }
              }}
              onExport={exportSubgraph}
            />
          </div>
        </div>
      </div>

      {/* ── SEARCH DROPDOWN ── */}
      {searchOpen && searchQuery.trim() && (
        <div
          style={{
            position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
            width: 500, maxHeight: 400, overflowY: 'auto',
            border: `3px solid ${BR}`, borderTop: `3px solid ${A}`,
            background: BG, boxShadow: `6px 6px 0 rgba(255,102,0,0.2)`,
            zIndex: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {searchLoading && (
            <div style={{ padding: 16, textAlign: 'center', color: DM, fontSize: 11 }}>/// SEARCHING...</div>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: DM, fontSize: 11 }}>/// ZERO_RESULTS</div>
          )}
          {searchResults.map((r: any) => {
            const tm = TM[r.type] || TM.reference;
            return (
              <div
                key={r.id}
                onClick={() => selectNode(r.id)}
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
                    {r.domain}
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 12, color: tm.c }}>[{tm.t}]</span>
              </div>
            );
          })}
          <div style={{
            padding: '6px 16px', borderTop: `1px solid ${GR}`,
            fontSize: 9, color: DM,
          }}>
            {searchResults.length} found · ESC to close
          </div>
        </div>
      )}

      {/* ── INGEST MODAL ── */}
      {ingestOpen && (
        <IngestModal
          onClose={() => setIngestOpen(false)}
          onCreated={async (id) => {
            setIngestOpen(false);
            await refreshData();
            setSelId(id);
          }}
        />
      )}

      {/* ── CHANGELOG PANEL ── */}
      {changelogOpen && (
        <ChangelogPanel
          entries={changelogData}
          onSelect={(id) => { selectNode(id); setChangelogOpen(false); }}
          onClose={() => setChangelogOpen(false)}
        />
      )}
    </div>
  );
}
