# NeuraFolio

Personal AI portfolio assistant — chat with your CV, projects, and experience via RAG.

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Frontend | Next.js (App Router) | Vercel |
| Backend | NestJS | Render |
| Database | Supabase (Postgres + pgvector) | Supabase |
| AI | Groq (primary), Gemini / Cerebras (fallback), Hugging Face embeddings | — |

## Structure

```text
neura-folio/
├── frontend/          # Next.js chat UI
├── backend/           # NestJS API, RAG, ingest
├── supabase/
│   └── schema.sql     # documents table + match_documents RPC
└── README.md
```

## Getting started

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Enable the **vector** extension (Database → Extensions).
3. Run `supabase/schema.sql` in the SQL Editor.

### 2. Backend

```bash
cd backend
cp .env.example .env   # after Milestone 1
npm run start:dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local   # after Milestone 4
npm run dev
```

## Milestones

- [x] **M0** — Folder skeleton + Supabase schema
- [ ] **M1** — NestJS + Supabase module
- [ ] **M2** — RAG, embeddings, multi-provider AI
- [ ] **M3** — Chat API with SSE streaming + citations
- [ ] **M4** — Next.js chat UI
- [ ] **M5** — Deploy (Render + Vercel) + ingest cron
