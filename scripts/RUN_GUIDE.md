# How to run everything — copy-paste guide

This assumes a completely fresh machine. Follow top to bottom, in order.
Each numbered step is something you run once. Steps marked "(keep running)"
need their own terminal tab/window that stays open.

---

## Step 1 — Install tools (one-time, ~15 min)

```bash
# Node.js 22 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm@9

# Docker Desktop — download manually from docker.com/products/docker-desktop
# Open it once so the Docker daemon is running before continuing.

# Verify
node --version    # v22.x
pnpm --version    # 9.x
docker --version  # any version is fine, just confirms it's installed
```

---

## Step 2 — Extract the project and get API keys (~5 min)

```bash
tar -xzf billing-platform-complete.tar.gz
cd billing-platform

cp .env.example apps/api/.env
```

Open `apps/api/.env` in a text editor and fill in:

```
DATABASE_URL=postgresql://billing_app:localdev123@localhost:5432/billing_db
REDIS_URL=redis://localhost:6379

JWT_SECRET=<run the command below to generate this>
ANTHROPIC_API_KEY=sk-ant-...        # from console.anthropic.com
RAZORPAY_KEY_ID=rzp_test_...        # from dashboard.razorpay.com (test mode)
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...          # set after Step 9 (Razorpay webhook setup)
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

You can leave `RAZORPAY_*` and `ANTHROPIC_API_KEY` blank for now if you just
want billing + invoices working first — the AI and payment-link features
will simply return clear errors until those are filled in, nothing else breaks.

---

## Step 3 — Install all dependencies (~3 min)

```bash
pnpm install
```

This resolves all 8 workspaces (apps/api, apps/web, apps/mobile,
packages/db, domain-registry, gst-engine, pdf, shared) in one shot.

---

## Step 4 — Start Postgres + Redis (~1 min)

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

You should see 4 containers, all "healthy" or "running":
`billing_postgres`, `billing_redis`, `billing_pgadmin`, `billing_redis_ui`

If any show "unhealthy" after 30 seconds, check logs:
```bash
docker compose -f docker/docker-compose.yml logs postgres
```

---

## Step 5 — Set up the database (~2 min)

```bash
pnpm db:migrate
```

This creates all core tables via Prisma. Then apply the 5 manual SQL
migrations (these add tables Prisma doesn't manage directly — sequences,
AI suggestions, idempotency, Razorpay orders, refresh tokens):

```bash
cd apps/api/src/lib
for f in invoice-sequences.sql ai-suggestions.sql idempotency.sql \
         razorpay-orders.sql refresh-tokens.sql; do
  echo "Applying $f..."
  docker exec -i billing_postgres psql -U billing_app -d billing_db < "$f"
done
cd ../../../../..
```

Seed test data:
```bash
pnpm db:seed
```

You'll see test login credentials printed at the end:
```
Kirana owner   — 9876543210 / PIN 1111
Kirana cashier — 9876500001 / PIN 2222
Restaurant     — 9898765432 / PIN 3333
Pharmacy       — 9925123456 / PIN 4444
```

**Verify tenant isolation works** (this is the single most important check):
```bash
docker exec -it billing_postgres psql -U billing_app -d billing_db -c "SELECT COUNT(*) FROM invoices;"
```
This MUST print `0`. If it prints actual rows, stop — Row Level Security
is not working and must be fixed before continuing.

---

## Step 6 — Start the backend API (keep running)

Open a **new terminal tab**, then:

```bash
cd billing-platform
pnpm dev --filter @billing/api
```

Leave this running. You should see:
```
Server running on http://localhost:3000
```

Quick check in any other terminal:
```bash
curl http://localhost:3000/health
# {"status":"ok",...}
```

---

## Step 7 — Run the test suite (~2 min)

In a **new terminal tab** (keep the API running in its own tab):

```bash
cd billing-platform
pnpm test
```

Expect roughly 150+ tests passing across every package: GST calculations,
invoice/product schemas, domain registry validation, password hashing,
idempotency (including a concurrency race test), Razorpay signature
verification, and refresh token rotation with reuse detection.

If something fails here, fix it before moving on — everything downstream
depends on these passing.

---

## Step 8 — Start the background workers (keep running)

Open **another new terminal tab**:

```bash
cd billing-platform
npx tsx apps/api/src/workers/index.ts
```

You should see:
```
[PDF Worker] Started — listening for jobs on pdf-generation queue
[WhatsApp Worker] Started — listening for whatsapp-send queue
```

This process generates invoice PDFs and sends WhatsApp messages in the
background. Without it running, invoices still create fine, but PDFs
never generate and WhatsApp messages never send.

---

## Step 9 — (Optional but recommended) Set up Razorpay webhooks locally

Only needed if you want to test real payment confirmation. Skip this if
you just want billing/invoicing working first.

```bash
# Install ngrok if you don't have it: https://ngrok.com/download
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL it gives you. In the Razorpay
dashboard (test mode): Settings → Webhooks → Add New Webhook:
- URL: `https://xxxx.ngrok.io/api/webhooks/razorpay`
- Active events: check `payment.captured`
- Copy the generated webhook secret into `apps/api/.env` as
  `RAZORPAY_WEBHOOK_SECRET`, then restart the API (Ctrl+C and re-run Step 6).

---

## Step 10 — Start the web dashboard (keep running)

Open **another new terminal tab**:

```bash
cd billing-platform
pnpm dev --filter @billing/web
```

Open **http://localhost:5173** in your browser.

Log in with: `9876543210` / PIN `1111`

You should land on the dashboard. Try creating an invoice — search for
"Amul Butter", add it to the cart, confirm the sale, and check that it
appears in the invoice list with the correct GST calculated.

---

## Step 11 — (Optional) Set up the mobile app

Only needed if you want to test the Android offline-billing app. This is
the most involved step — budget 20-30 minutes the first time, mostly for
Android Studio / emulator setup if you don't already have it.

```bash
# Install Android Studio from developer.android.com/studio if you haven't.
# Open it once, let it install the SDK and create a virtual device (emulator).

cd apps/mobile
npx react-native init BillingMobileNative --version 0.74.3 --skip-install
# This generates a native /android folder — copy it into apps/mobile/android

# Add microphone permission for voice billing — edit
# apps/mobile/android/app/src/main/AndroidManifest.xml and add:
#   <uses-permission android:name="android.permission.RECORD_AUDIO" />

npx react-native start
```

In **another new terminal tab**:
```bash
cd billing-platform/apps/mobile
npx react-native run-android
```

This builds and installs the app on your emulator (or a connected
physical device). Log in with the same test credentials. The Android
emulator reaches your API automatically via `10.0.2.2:3000` — no config
needed for emulator testing.

**For a real phone on the same WiFi**, find your computer's LAN IP:
```bash
ipconfig getifaddr en0     # macOS
# or: hostname -I          # Linux
```
Then edit `apps/mobile/src/lib/apiClient.ts` and replace `10.0.2.2:3000`
with `<your-ip>:3000`.

---

## What you should have running, all at once

By the end of this guide, you'll have **4 terminal tabs open simultaneously**:

| Tab | Command | What it does |
|---|---|---|
| 1 | `docker compose ... up -d` (then idle) | Postgres + Redis containers |
| 2 | `pnpm dev --filter @billing/api` | API server on :3000 |
| 3 | `npx tsx apps/api/src/workers/index.ts` | PDF + WhatsApp background jobs |
| 4 | `pnpm dev --filter @billing/web` | Web dashboard on :5173 |

Plus optionally:
| 5 | `npx react-native start` | Metro bundler for mobile |
| 6 | `npx react-native run-android` (one-shot, not kept running) | Installs the app |

---

## Every day after the first time

You don't need to repeat Steps 1-3 or the migrations. Just:

```bash
docker compose -f docker/docker-compose.yml up -d   # if not already running
pnpm dev                                              # starts API + web together via Turborepo

# In separate tabs, if needed:
npx tsx apps/api/src/workers/index.ts
npx react-native start    # only if testing mobile
```

---

## Common problems

**`docker compose ps` shows postgres as unhealthy**
Usually means the port 5432 is already taken by another Postgres install
on your machine. Stop any local Postgres service, or change the port
mapping in `docker/docker-compose.yml`.

**Login fails with "Invalid phone or PIN" even with seed credentials**
You likely seeded data before applying Fix 1 (bcrypt). Old SHA-256
password hashes don't verify under bcrypt. Fix: `pnpm db:reset` to wipe
and re-seed fresh.

**API starts but every request returns 500**
Check `apps/api/.env` has a valid `DATABASE_URL` and that
`docker compose ps` shows Postgres healthy. Check the API terminal's
logs for the actual error — Fastify logs are verbose in development.

**Mobile app can't reach the API ("Network Error")**
Emulator: confirm the API is actually running on :3000 on your host
machine (not just the container — Postgres and Redis are containerized,
but the API itself runs directly on your machine via `pnpm dev`).
Real device: confirm you updated the LAN IP in `apiClient.ts` and that
your phone and computer are on the same WiFi network.

**`pnpm test` fails on idempotency or refreshToken tests specifically**
These tests need a real Postgres connection with the relevant migrations
applied. Re-run Step 5's manual SQL migration loop — it's likely one of
the 5 files wasn't applied.
