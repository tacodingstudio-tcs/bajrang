# Hotel Platform — Local → Production Runbook

Everything done to run this project locally and deploy it, in order, including the
problems hit and their fixes. **No secrets belong in this file** — keep them in
`apps/api/.env` (local) and the Render / Vercel dashboards (production).

Last updated: 2026-10-01

---

## 0. Architecture of the deployment

| Piece | Where | Plan | Notes |
|---|---|---|---|
| API (`apps/api`, Fastify) | Render web service `hotel-api` | Free (0.1 CPU / 512 MB) | Sleeps after ~15 min idle; first request ~30–60 s |
| Background workers (BullMQ) | Same process as the API | — | `RUN_WORKERS_INLINE=true`; no separate worker service |
| Database | Neon Postgres | — | Use the **direct** (non-pooled) connection string |
| Redis | Upstash or Render Key Value | — | Set `REDIS_URL` |
| Public website (`apps/website`) | Vercel | — | Calls `VITE_API_URL` + `/api/public` |
| Admin web (`apps/web`) | not deployed yet | — | Vite `base: '/admin/'` |

Source repo: `https://github.com/tacodingstudio-tcs/bajrang` (branch `master`).
Render account: tacodingstudio@gmail.com. Another paid service ("tacoding") exists in the
same account; this API is deliberately on the Free plan.

---

## 1. Run locally

### 1.1 Prerequisites
- Node 22 (Node 20 worked locally but `engines` says >=22), pnpm 9
- Docker Desktop **running** (start it first — `docker ps` fails if the daemon is off)

### 1.2 Start Postgres + Redis
```bash
cd docker
docker compose up -d postgres redis
```
Ports used by this repo's compose file: **Postgres 5433**, **Redis 6380**
(not the 5432 / 6379 mentioned in CLAUDE.md). `apps/api/.env` already points there:
`DATABASE_URL=postgresql://hotel_app:<pw>@localhost:5433/hotel_db`, `REDIS_URL=redis://localhost:6380`.

### 1.3 Migrate the database
```bash
cd packages/db
set -a; . ../../apps/api/.env; set +a      # load env (bash)
npx prisma migrate deploy
```
- If you get `P3005 database schema is not empty`, the DB has stray tables. On a fresh
  local container only an empty `public.refresh_tokens` existed; it was dropped
  (`docker exec hotel_postgres psql -U hotel_app -d hotel_db -c 'drop table public.refresh_tokens'`)
  and migrations then applied (19 total).
- **`pnpm db:seed` is currently broken**: fails in `seedExtraTables` with
  `The column branchId does not exist` on model `Batch`. Skip it and register a demo
  tenant through the API instead (below).

### 1.4 Start the API
Port 3000 may be taken by a stale node process; use 3001:
```bash
cd apps/api
PORT=3001 pnpm dev            # tsx watch --env-file=.env src/server.ts
curl localhost:3001/health    # {"status":"ok",...}
```

### 1.5 Create a demo hotel
Registration takes a **4-digit PIN** (not a password):
```bash
curl -X POST localhost:3001/api/tenants/register -H 'content-type: application/json' \
  -d '{"businessName":"Demo Hotel","ownerName":"Demo Owner","phone":"9000000001","pin":"1234","domainType":"hotel"}'
```
Demo login: phone `9000000001`, PIN `1234` (local only).
Login (`POST /api/auth/login`) also requires a `tenantPhone` field — **login with these
credentials was not verified end-to-end**.

### 1.6 Start the frontends
Both Vite dev servers proxy `/api` to the API; the proxy target was changed from
`localhost:3000` to `localhost:3001`. Change it back if you free port 3000.
```bash
cd apps/web     && pnpm dev    # http://localhost:5173/admin/
cd apps/website && pnpm dev    # http://localhost:5174/
```

---

## 2. Deploy the website to Vercel

Files in `apps/website`: `vercel.json` (SPA rewrite, `npx vite build`), `.vercelignore`
(skips node_modules / dist / dist.zip), and a **self-contained `tsconfig.json`**
(it used to `extends ../../tsconfig.base.json`, which is not uploaded by `vercel deploy`
from this folder and made the build fail).

```bash
cd apps/website
npx vercel whoami           # logged in as tacodingstudio
npx vercel deploy --yes     # preview
npx vercel deploy --prod    # production (not run yet)
```
- Preview URL (first deploy): `https://website-qxt1x1opi-hirenkumar-vadhels-projects.vercel.app`
  — returned 302 (Vercel Deployment Protection); turn it off in Project → Settings if the
  site must be public.
- The Vercel build skips `tsc` (build command is `npx vite build`); typecheck runs locally
  via `npm run build`.
- API URL comes from `VITE_API_URL` (`apps/website/.env.production`, or a Vercel env var).
  It currently points at the old suspended Render URL — **update it to the new API URL and
  redeploy**.

---

## 3. Deploy the API to Render

### 3.1 Repo
```bash
git remote add origin https://github.com/tacodingstudio-tcs/bajrang.git
git -c http.sslBackend=schannel push -u origin master
```
`http.sslBackend=schannel` fixes `SSL certificate problem: unable to get local issuer
certificate` on this Windows machine (certificate verification stays on).
In Claude Code sessions the push is blocked by the permission classifier — run it yourself
in a terminal.

### 3.2 Render service settings (Node runtime, Free instance)
Create **New → Web Service**, repo `bajrang`, branch `master`.

| Field | Value |
|---|---|
| Runtime | Node (a Docker runtime with `./Dockerfile.api` also works) |
| Root Directory | *(empty)* |
| Build Command | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @billing/db exec prisma generate` |
| Start Command | `cd apps/api && npx tsx src/server.ts` |
| Instance Type | Free |
| Health Check Path | `/health` |

Environment variables (set in the dashboard; never commit values):
`NODE_VERSION=22`, `NODE_ENV=production`, `PORT=3000`, `RUN_WORKERS_INLINE=true`,
`STORAGE_TYPE=local`, `JWT_EXPIRES_IN=15m`, `DATABASE_URL` (Neon **direct** string),
`REDIS_URL`, `JWT_SECRET` (64-char random), `WEB_URL` (comma-separated allowed origins,
e.g. the Vercel domain), plus optional `RAZORPAY_*`, `WHATSAPP_*`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`.

`render.yaml` in the repo describes the same single free service (the `hotel-workers`
service was removed). Using New → Blueprint reads it; make sure the Blueprint's branch is
`master`, otherwise Render shows the old two-service (both Starter) layout.

### 3.3 Run migrations on Neon (once)
```bash
cd packages/db
DATABASE_URL="<neon direct url>" npx prisma migrate deploy
```

### 3.4 Verify
`curl https://<service>.onrender.com/health` → `{"status":"ok",...}`

---

## 4. Problems hit and fixes (in order)

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | `docker ps` cannot connect to engine | Docker Desktop not running | Start Docker Desktop, then `docker compose up -d postgres redis` |
| 2 | `P3005` on `prisma migrate deploy` | Stray empty `refresh_tokens` table | Drop it, re-run migrate |
| 3 | `db:seed` fails: `Batch.branchId` missing | Seed script out of sync with schema | Skip seed; register tenant via API |
| 4 | Register returns `pin: Required` | Schema takes a 4-digit PIN | Send `pin`, not `password` |
| 5 | Port 3000 busy, `/health` hangs | Stale node process | Run API on `PORT=3001` |
| 6 | Vercel build: `Cannot read file '/tsconfig.base.json'` | tsconfig extends a file outside the upload | Inline options in `apps/website/tsconfig.json` |
| 7 | Git push SSL error | Git's bundled cert store | `-c http.sslBackend=schannel` |
| 8 | Render: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL "prisma" not found` | `NODE_ENV=production` skips devDependencies (`prisma`, `tsx`) | `pnpm install --prod=false` in the build command |
| 9 | Render startup: `Cannot find package '@billing/pdf'` | `apps/api/package.json` lacked the dep (only worked locally via `scripts/fix-workspace-links.mjs` junctions) | Added `"@billing/pdf": "workspace:*"` + lockfile (commit `350cddc`) |
| 10 | Render shows 2 paid services | Blueprint read old `render.yaml` / wrong branch | Use `master`; or create a plain Web Service |
| 11 | Local `docker build -f Dockerfile.api` fails at `corepack prepare pnpm` | Network / antivirus HTTPS interception on this machine (Render unaffected) | Not needed for Render Node runtime; ignore or fix the local network |

Original service `hotel-api-latest-lfs3.onrender.com` returned **"Service Suspended"**;
the new service gets a new URL.

---

## 5. Free-plan caveats
- Service sleeps when idle; BullMQ jobs (reminders, WhatsApp) only run while it is awake.
- Local-disk uploads (`STORAGE_TYPE=local`) are lost on every restart/redeploy.
- Puppeteer downloads Chromium at install; if the build is killed for memory, set
  `PUPPETEER_SKIP_DOWNLOAD=true` (PDF generation may then not work).
- Render may require a card on file even for Free; confirm the total shows $0.

---

## 6. Checklist for the next deploy
1. `pnpm --filter @hotel/api typecheck`
2. Commit; if dependencies changed, run `pnpm install --lockfile-only` and commit
   `pnpm-lock.yaml` (Render uses `--frozen-lockfile`).
3. `git -c http.sslBackend=schannel push` (Render auto-deploys `master`).
4. Check the Render deploy log, then `/health`.
5. If the API URL changed: update `VITE_API_URL`, then `npx vercel deploy --prod` in `apps/website`.
6. Set `WEB_URL` on Render to include the Vercel domain (CORS).

## 7. Open items
- [ ] Confirm the Render deploy of commit `350cddc` starts and `/health` is ok
- [ ] Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_URL` on Render; run migrations on Neon
- [ ] Update `VITE_API_URL` for the website and `vercel deploy --prod`
- [ ] Decide on deploying `apps/web` (admin, base `/admin/`)
- [ ] Fix `db:seed` (`Batch.branchId`)
- [ ] Uncommitted local edits not yet in git: Vite proxy 3000→3001, website Vercel files/tsconfig, `apps/web` changes
- [ ] Check that `apps/api/.env` is never committed (it holds real-looking keys; rotate any that were exposed)
