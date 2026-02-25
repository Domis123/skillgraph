# SkillGraph Phase 1 — Cursor Setup Guide

## Prerequisites
- Node.js 20+ installed (`node --version` to check)
- Git installed
- Cursor IDE open

---

## Step 1: Create Project

Open Cursor terminal (Ctrl+`) and run:

```bash
mkdir ~/skillgraph
cd ~/skillgraph
git init
```

Extract the tar.gz into this folder, then open it in Cursor:
```bash
# After extracting:
cursor ~/skillgraph
```

Your Cursor sidebar should show:
```
skillgraph/
├── vault/          (15 .md files across subfolders)
├── api/            (src/ with 7 .ts files)
├── Dockerfile
├── .env.example
└── .gitignore
```

---

## Step 2: Install & Configure

In Cursor terminal:

```bash
cd api
npm install
cd ..
cp .env.example .env
```

Open `.env` in Cursor and set your API key:
```
PORT=3456
VAULT_PATH=../vault
SG_API_KEY=sk_sg_pick_any_secret_string_here
```

---

## Step 3: Run Locally

```bash
cd api
npm run dev
```

Expected output:
```
[skillgraph] Scanning vault...
[vault] Scanned: 15 nodes, 25 edges
[skillgraph] API running on http://localhost:3456
```

---

## Step 4: Test (open second terminal tab: Ctrl+Shift+`)

```bash
# Health
curl http://localhost:3456/

# List nodes
curl http://localhost:3456/v1/nodes

# Single node JSON
curl http://localhost:3456/v1/nodes/skill-cms-schema-registry

# Raw markdown (what AIs read)
curl http://localhost:3456/v1/nodes/skill-cms-schema-registry/raw

# Search
curl "http://localhost:3456/v1/search?q=error"

# Graph data
curl http://localhost:3456/v1/graph

# Static vault path
curl http://localhost:3456/vault/skills/content-system/cms-schema-registry.md
```

---

## Step 5: Test Ingest

```bash
curl -X POST http://localhost:3456/v1/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_sg_pick_any_secret_string_here" \
  -d '{
    "type": "lesson",
    "title": "Test From Cursor",
    "domain": "meta",
    "content": "# Test\n\nCreated via ingest API.",
    "tags": ["test"],
    "confidence": "low"
  }'
```

Check Cursor sidebar — new file appears at `vault/lessons/test-from-cursor.md`

---

## Step 6: Add .cursorrules

Create `.cursorrules` in project root:

```
# SkillGraph — Personal Knowledge Graph

## Project Structure
- vault/ — Markdown knowledge nodes with YAML frontmatter
- api/ — Hono.js REST API (TypeScript)

## Node Frontmatter Fields
id, type, title, domain, tags, status, confidence, created, updated, connections[]

## Valid Types: skill, lesson, project, tool, concept, reference
## Valid Edges: depends_on, part_of, related_to, uses, supersedes

## API: port 3456
- GET /v1/nodes, /v1/nodes/:id, /v1/nodes/:id/raw, /v1/search?q=, /v1/graph
- POST /v1/nodes, /v1/ingest (require Authorization: Bearer header)
- GET /vault/path/to/file.md (static markdown)

## When creating vault nodes
- Include all frontmatter fields
- id format: {type}-{slug} (e.g. skill-cms-schema-registry)
- Use [[node-id]] for cross-references in body
```

---

## Step 7: Push to GitHub (private repo)

```bash
git add .
git commit -m "Phase 1: API + 15 seed nodes"
git remote add origin https://github.com/YOUR_USERNAME/skillgraph.git
git branch -M main
git push -u origin main
```

---

## Step 8: Deploy to Railway

1. [railway.app](https://railway.app) → sign in with GitHub
2. New Project → Deploy from GitHub → select `skillgraph`
3. Variables tab → add: `PORT=3456`, `VAULT_PATH=/app/vault`, `SG_API_KEY=your_prod_key`
4. Deploy → Settings → Networking → Generate Domain
5. Test: `curl https://your-app.up.railway.app/`

---

## Step 9: Test AI Access

In Claude or any AI chat:
```
Read this and summarize: https://your-app.up.railway.app/v1/nodes/skill-cms-schema-registry/raw
```

---

## Checklist

☐ `npm run dev` starts, shows 15 nodes
☐ curl endpoints all respond
☐ Ingest creates .md file in vault
☐ `.cursorrules` in project root
☐ Pushed to private GitHub repo
☐ Railway deployed and responding

All green → Phase 2 (Monolith dashboard).
