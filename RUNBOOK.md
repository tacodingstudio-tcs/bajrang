# Hotel Platform — Local → Production Runbook

Everything done to run this project locally and deploy it, in order, including the
problems hit and their fixes. **No secrets belong in this file** — keep them in
`apps/api/.env` (local) and the Render / Vercel dashboards (production).

Last updated: 2026-10-01 (admin deployed, CORS + registration issues logged)

---

## 0. Architecture of the deployment

| Piece | Where | Plan | Notes |
|---|---|---|---|
| API (`apps/api`, Fastify) | Render web service `hotel-api` | Free (0.1 CPU / 512 MB) | Sleeps after ~15 min idle; first request ~30–60 s |
| Background workers (BullMQ) | Same process as the API | — | `RUN_WORKERS_INLINE=true`; no separate worker service |
| Database | Neon Postgres | — | Use the **direct** (non-pooled) connection string |
| Redis | Upstash or Render Key Value | — | Set `REDIS_URL` |
| Public website (`apps/website`) | Vercel project `website` | — | Calls `VITE_API_URL` + `/api/public`; https://bajrang-rest-inn.vercel.app |
| Admin web (`apps/web`) | Vercel project `bajrang-rest-inn-admin` | — | Vite `base: '/admin/'`; https://bajrang-rest-inn.vercel.app/admin (proxied) and https://bajrang-rest-inn-admin.vercel.app/admin/ |

Source repo: `https://github.com/tacodingstudio-tcs/bajrang` (branch `master`).
Live API: `https://bajrang-v7d6.onrender.com`. Render account: tacodingstudio@gmail.com. Another paid service ("tacoding") exists in the
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

### 1.7 Logins
Admin login takes **three** fields: Business phone (`tenantPhone`), Your phone (`phone`) and a
4-digit PIN. For the owner both phones are the number used at registration.

| Environment | Hotel | Phones | PIN | Status |
|---|---|---|---|---|
| Local (`localhost:3001`) | Demo Hotel | 9000000001 | 1234 | Created locally; works only against the local DB |
| Live (Render + Neon) | Bajrang Rest Inn | 8291584341 | 1012 | **Not created yet** — registration returned HTTP 500 (see section 4, #12) |

Typing the local demo credentials on the live admin shows "Invalid phone number or PIN"
(real 401) because that account does not exist on Neon.

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

### 2.1 Admin app (`apps/web`) as a second Vercel project
`apps/web` is a separate Vercel project (`bajrang-rest-inn-admin`). Files in `apps/web`:
`vercel.json`, `.vercelignore`, `.env.production` (`VITE_API_URL`), and a self-contained
`tsconfig.json`. `vercel.json` install command runs
`npm pkg delete dependencies.@billing/shared devDependencies.@billing/shared && npm install`
because `workspace:*` cannot be installed by npm and the package is unused in `src/`.
Vite `base` is `/admin/`, so `vercel.json` rewrites `/admin/<file.ext>` to `/<file.ext>` and
other `/admin/*` to `/index.html`.

```bash
cd apps/web
npx vercel link --yes --project bajrang-rest-inn-admin   # first time only
npx vercel deploy --prod --yes
npx vercel project protection disable bajrang-rest-inn-admin --sso   # make public
```

The website project serves `/admin` by rewriting to the admin project
(`apps/website/vercel.json`: `/admin`, `/admin/`, `/admin/:path*` ->
`https://bajrang-rest-inn-admin.vercel.app/admin...`). The explicit `/admin/` rule is needed;
without it the trailing-slash URL falls through to the website's SPA.

### 2.2 Public URL / alias
Preview URLs are random per deploy. The friendly URL is an alias that must be re-pointed
after every website deploy (or rename the Vercel project to `bajrang-rest-inn` to get it
automatically):
```bash
npx vercel alias set <new-deployment-url> bajrang-rest-inn.vercel.app
npx vercel project protection disable website --sso    # Deployment Protection off = public
```
Domains cannot contain underscores (`bajrang-rest-inn`, not `bajrangrest_inn`).

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
`STORAGE_TYPE=local`, `FORCE_SEARCH_PATH=true` (required on Neon), `JWT_EXPIRES_IN=15m`, `DATABASE_URL` (Neon **direct** string),
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

### 3.3b Install `create_tenant_schema()` on Neon (required once)
The function is **not** created by Prisma migrations. `neon-create-tenant-schema.sql` is
`docker/init.sql` lines 66+ with the local-only role grants removed (tested: provisions 28
tables). Run with the Neon **direct** URL (no local psql needed):
```bash
docker run --rm -i postgres:16-alpine psql "<NEON_DIRECT_URL>" -v ON_ERROR_STOP=1 -f - < neon-create-tenant-schema.sql
```
Then register the hotel (section 1.5 payload against the live API). Registration also needs
the `pgcrypto` extension (`gen_random_uuid`); Neon supports `CREATE EXTENSION pgcrypto`.

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
| 12 | Live `POST /api/tenants/register` returns `500` | (a) `public.create_tenant_schema()` lives only in `docker/init.sql`, not in any Prisma migration, so Neon never got it; (b) **Neon ignores Prisma's `?schema=` search_path** (`SHOW search_path` stays `"$user", public`), so unqualified raw SQL like `INSERT INTO invoice_sequences` fails with `relation does not exist` (Render log: `42P01`, `tenants.ts:215`) | (a) load `neon-create-tenant-schema.sql` once (section 3.3b). (b) set `FORCE_SEARCH_PATH=true` on Render — `lib/tenant-db.ts` then wraps every raw query/transaction in `SET LOCAL search_path` (diagnose with `packages/db/prisma/check-searchpath.ts`) |
| 13 | Public site: `No hotel tenant configured` | `resolveHotelTenant()` required a slug containing "hotel" | Now matches the tenant whose branch has `domainType='hotel'` (`routes/public.ts`, local change — commit + push needed) |
| 14 | Admin login shows "Connection error — check your internet" | CORS: live API sends no `access-control-allow-origin` for the Vercel origins because `WEB_URL` on Render does not list them | Set `WEB_URL=https://bajrang-rest-inn.vercel.app,https://bajrang-rest-inn-admin.vercel.app` on Render and redeploy |
| 15 | Vercel opens a "request access / log in" page | Deployment Protection (SSO) on | `npx vercel project protection disable <project> --sso` |
| 16 | `/admin` is 404 on the website domain | Admin app was not deployed | Section 2.1 |
| 17 | `/admin/` (trailing slash) shows the website instead of the admin | `/admin/:path*` does not match the bare trailing-slash path | Explicit `/admin/` rewrite |
| 18 | Admin Vercel install fails on `workspace:*` | npm cannot resolve the pnpm workspace protocol | `npm pkg delete ...@billing/shared` in the install command |

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
- [x] Render deploy of `350cddc` is up; `/health` returns ok
- [ ] **Set `WEB_URL` on Render** to both Vercel origins (fixes admin "Connection error")
- [ ] Push the `FORCE_SEARCH_PATH` fix, set `FORCE_SEARCH_PATH=true` on Render, then register Bajrang Rest Inn (owner Bajrang, 8291584341, PIN 1012)
- [ ] Commit + push `routes/public.ts` lookup change, `apps/web` + `apps/website` Vercel files
- [ ] Run `prisma migrate deploy` against Neon if missing tables are confirmed
- [x] `VITE_API_URL` set to the new API for website and admin, both deployed to production
- [x] Admin (`apps/web`) deployed to Vercel and routed at `/admin`
- [ ] Rebrand admin title ("BillBook — Smart Billing")
- [ ] Fix `db:seed` (`Batch.branchId`)
- [ ] Uncommitted local edits not yet in git: Vite proxy 3000→3001, website Vercel files/tsconfig, `apps/web` changes
- [ ] Check that `apps/api/.env` is never committed (it holds real-looking keys; rotate any that were exposed)
