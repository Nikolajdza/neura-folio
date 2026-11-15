# Deploy NeuraFolio (free)

Repo: https://github.com/Nikolajdza/neura-folio  
Frontend: https://neura-folio.vercel.app  

## 1. Render backend (required)

1. Open Blueprint:  
   https://dashboard.render.com/blueprint/new?repo=https://github.com/Nikolajdza/neura-folio
2. Apply `render.yaml` (web service `neura-folio-backend` + nightly ingest cron).
3. Set these env vars on the **web** service:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `GROQ_API_KEY` | your Groq key |
| `GITHUB_USERNAME` | `nikolajdza` |
| `CORS_ORIGIN` | `https://neura-folio.vercel.app` |
| `INGEST_SECRET` | strong random string (admin re-ingest only) |
| `EMBEDDING_PROVIDER` | `local` |
| `AGENT_MODE` | `true` |
| `RAG_HYBRID` | `true` |

4. Deploy → wait until service is Live.  
   Expected URL: `https://neura-folio-backend.onrender.com`
5. Smoke test: `https://neura-folio-backend.onrender.com/health`
6. Run one ingest (Render Shell or Cron): `npm run ingest`  
   (first boot may take a few minutes while the embedding model downloads)

## 2. UptimeRobot (keep free Render awake)

- Monitor type: HTTP(s)
- URL: `https://neura-folio-backend.onrender.com/health`
- Interval: 5 minutes

## 3. Vercel frontend (already created)

- Project: `neura-folio`
- Root Directory: `frontend`
- Env: `NEXT_PUBLIC_BACKEND_URL=https://neura-folio-backend.onrender.com`
- Production: https://neura-folio.vercel.app

If the backend URL differs, update the Vercel env and redeploy.

## Notes

- Free Render sleeps after idle; UptimeRobot prevents cold starts.
- Local embeddings on free tier can be memory-heavy on first start — give it time.
- Session CV upload is in-memory on the backend instance (resets on sleep/redeploy; refresh also clears guest CV).
