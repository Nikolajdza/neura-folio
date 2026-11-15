# NeuraFolio

Personal AI portfolio assistant — chat with your CV, projects, and experience via RAG.

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Frontend | Next.js (App Router) | Vercel |
| Backend | NestJS | Render |
| Database | Neon (Postgres + pgvector + hybrid FTS) | Neon |
| AI | Groq (+ Gemini/Cerebras fallback), local embeddings, optional tool agent | — |

## Structure

```text
neura-folio/
├── frontend/          # Next.js chat UI
├── backend/           # NestJS API, RAG, ingest, eval
│   └── data/          # CV.pdf (gitignored)
├── db/schema.sql
├── evals/questions.json
├── render.yaml
└── README.md
```

## Local setup

### 1. Neon

1. Create a project at [neon.com](https://neon.com).
2. Run **full** `db/schema.sql` in SQL Editor (includes hybrid search).
3. Copy the pooled `DATABASE_URL`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill DATABASE_URL, GROQ_API_KEY, GITHUB_USERNAME, INGEST_SECRET
npm run start:dev
# Health: http://localhost:3001/health
```

### 3. Ingest

```bash
# Place CV at backend/data/CV.pdf, then:
npm run ingest

# Or upload from the UI (header → Upload CV) using INGEST_SECRET
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local
npm run dev
# http://localhost:3000
```

### 5. Eval

```bash
cd backend
npm run eval
```

## Deploy (Milestone 5)

1. **Render**: connect repo, use `render.yaml` (web + nightly ingest cron).
2. Set env vars on Render (`DATABASE_URL`, `GROQ_API_KEY`, `INGEST_SECRET`, `CORS_ORIGIN`, …).
3. **UptimeRobot**: ping `https://YOUR-BACKEND.onrender.com/health` every 5–10 min (keeps free tier awake).
4. **Vercel**: import `frontend/`, set `NEXT_PUBLIC_BACKEND_URL` to the Render URL.

## API

- `GET /health`
- `POST /api/chat` — UI message SSE stream + sources/follow-ups
- `POST /api/ingest/cv` — multipart PDF upload (`x-ingest-secret`)
- `POST /api/ingest/run` — full re-ingest (`x-ingest-secret`)

## Milestones

- [x] M0 — Skeleton + schema
- [x] M1 — NestJS + Neon
- [x] M2 — RAG + ingest + local embeddings
- [x] M3 — Chat SSE + citations
- [x] M4 — Next.js chat UI
- [x] M5 — Deploy configs + cron + upgrades (upload, hybrid, agent, eval, i18n, rate limit)
