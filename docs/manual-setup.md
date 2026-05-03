# Scribix — manual setup checklist

Everything that can't be automated, in one place. Work top to bottom; you can stop after any phase boundary and pick it up later. Items marked **(blocking)** prevent that phase from running locally; items marked **(deploy-only)** are only required before pushing to Cloudflare.

> **Tip:** values you generate here go into two files:
> - `.env.local` — read by `next dev`
> - `.dev.vars` — read by `wrangler dev` / `npm run preview` (same KEY=VALUE format, no quoting)
>
> Both files are gitignored. Mirror everything except the OAuth callback URL into both.

---

## Phase 0 — bootstrap

### 0.1 Cloudflare account + wrangler login (blocking)

```sh
npx wrangler login
```

Browser will open Cloudflare; approve. After this, `wrangler whoami` should print your account email and account ID — copy the **Account ID**, you'll need it for R2 presign.

### 0.2 Create D1 database (blocking)

```sh
npx wrangler d1 create scribix-db
```

Output looks like:
```
[[d1_databases]]
binding = "DB"
database_name = "scribix-db"
database_id = "abc123-..."
```

Open `wrangler.jsonc`, replace `"PLACEHOLDER_RUN_WRANGLER_D1_CREATE"` with the `database_id` value.

Then apply migrations to local + remote:
```sh
npm run db:migrate:local      # required for local dev
npm run db:migrate:remote     # required before any deploy
```

### 0.3 Create R2 bucket (blocking)

```sh
npx wrangler r2 bucket create scribix-media
```

### 0.4 R2 CORS (blocking — required for browser uploads)

Save the following as `r2-cors.json` in repo root (gitignored):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://scribix.io"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add any preview / staging origins you actually use. Apply:
```sh
npx wrangler r2 bucket cors put scribix-media --file r2-cors.json
```

### 0.5 R2 lifecycle: delete audio after 7 days (deploy-only, do before launch)

```sh
npx wrangler r2 bucket lifecycle add scribix-media \
  --id audio-7d --prefix audio/ --expire-days 7
```

Verify with `npx wrangler r2 bucket lifecycle list scribix-media`.

### 0.6 R2 API tokens for presign (blocking — Phase 2 onwards)

The Workers binding can't presign. We sign S3 requests via `aws4fetch`, which needs separate API credentials.

1. Cloudflare Dashboard → **R2** → **Manage R2 API Tokens** → **Create Token**.
2. Permissions: **Object Read & Write**.
3. Specify bucket: `scribix-media`.
4. TTL: forever (or your preference).
5. Copy the **Access Key ID** and **Secret Access Key** — they're shown once.

Drop into `.env.local` and `.dev.vars`:
```
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
CF_ACCOUNT_ID=...                # from `wrangler whoami`
```

---

## Phase 1 — auth

### 1.1 Generate AUTH_SECRET (blocking)

```sh
openssl rand -base64 32
```

Paste into `.env.local` and `.dev.vars` as `AUTH_SECRET=...`.

### 1.2 Google OAuth credentials (blocking)

1. https://console.cloud.google.com/apis/credentials → your project (create one if needed).
2. **Create Credentials** → **OAuth client ID** → **Web application**.
3. **Authorized redirect URIs** — add **all** that you'll use:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-ngrok-id>.ngrok.io/api/auth/callback/google` (Phase 2 webhook testing — see 2.1)
   - `https://scribix.io/api/auth/callback/google` (production)
4. **Authorized JavaScript origins** — required for **Google One-Tap** (Phase 8). This is a separate field from redirect URIs. Add:
   - `http://localhost:3000`
   - `https://<your-ngrok-id>.ngrok.io` (only if testing One-Tap on a public dev URL)
   - `https://scribix.io` (production)

   One-Tap loads `gsi/client` in the browser; the prompt silently fails if the page origin isn't on this list. Missing origins is the #1 cause of "One-Tap not showing up" in dev.
5. Copy the **Client ID** and **Client Secret**.
6. Drop into `.env.local` and `.dev.vars`:
   ```
   GOOGLE_ID=...
   GOOGLE_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   ```
   On the deployed Worker, set `NEXTAUTH_URL=https://scribix.io` in the Worker's environment variables (Cloudflare dashboard → Workers → scribix → Settings → Variables).

> **OAuth consent screen:** if you've never published a Google Cloud project, the consent screen will block sign-ins from accounts not on the test-user list. Either add your test accounts, or publish the consent screen (review-required for sensitive scopes; we only ask for profile + email so it's fine).

---

## Phase 2 — transcription pipeline

### 2.1 ngrok for AssemblyAI webhooks in dev (blocking — only when you want to test the webhook locally)

AssemblyAI can't reach `localhost`. Two options:

**Option A — ngrok (recommended for dev testing):**
1. Install: https://ngrok.com/download
2. Authenticate: `ngrok config add-authtoken <your-token>`
3. In a separate terminal: `ngrok http 3000`
4. Copy the `https://abc123.ngrok.io` URL. Set in `.env.local`:
   ```
   ASSEMBLYAI_WEBHOOK_URL=https://abc123.ngrok.io/api/webhook/assemblyai
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```
5. Restart `next dev` (env changes need a restart).
6. Add the ngrok URL to your Google OAuth allowed callbacks (1.2 step 3).

**Option B — skip the webhook in dev:**
The inline reconcile path on `/api/transcripts/[id]/status` (every poll, after 15min, hits AAI directly) will pick up completion without a webhook. Slower but no infra needed. Use this if you only care about wiring, not webhook timing.

### 2.2 AssemblyAI API key (blocking)

1. https://www.assemblyai.com/dashboard → **API Keys**.
2. Copy the key.
3. Drop into `.env.local` and `.dev.vars`:
   ```
   ASSEMBLYAI_API_KEY=...
   ```

For deployed environments, set the same secret on the Worker:
```sh
npx wrangler secret put ASSEMBLYAI_API_KEY
```

---

## Phase 4 — payments (Creem)

> **v1.0 soft-launch note:** this entire phase is **deferred to v1.1**. The soft launch ships auth + Free tier only — `/api/billing/checkout` + `/api/billing/portal` return 404, the Pricing component is hidden from the homepage, and the Creem webhook handler stays mounted but dormant. Skip the rest of this section until you're ready to flip paid tiers on. See `progress.md` §14 Phase 8 for the soft-launch checklist.

### 4.1 Creem dashboard setup (blocking — Phase 4 onwards)

1. https://dashboard.creem.io → create products for each tier:
   - Basic monthly ($9), Basic yearly ($64.80)
   - Pro monthly ($19), Pro yearly ($136.80)
2. Copy each `product_id` — you'll paste them into `lib/plans.ts`.
3. **Customer portal config:** disable plan-switching (only allow cancel + billing details). Pixfy → Pro downgrade is blocked at the portal level per plan §1.
4. **Webhook endpoint:**
   - Local: `https://<ngrok>/api/webhook/creem`
   - Prod: `https://scribix.io/api/webhook/creem`
5. Copy the **webhook signing secret** and the **API key**.

Drop into `.env.local` / `.dev.vars`:
```
CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...
NEXT_PUBLIC_CREEM_ENV=test       # or 'live' in prod
```

Push to Worker:
```sh
npx wrangler secret put CREEM_API_KEY
npx wrangler secret put CREEM_WEBHOOK_SECRET
```

---

## Phase 6 — admin + ops

### 6.1 Admin allowlist

In `.env.local`, `.dev.vars`, and Worker secrets:
```
ADMIN_EMAILS=you@example.com,teammate@example.com
```

### 6.2 Discord error alerts (optional but recommended)

1. Discord server → channel settings → **Integrations** → **Webhooks** → **New Webhook**.
2. Copy the webhook URL.
3. Set:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

### 6.3 Monthly AAI bulk-delete cron

Documented as a runbook (not code). Runs once a month:

```sh
# Pseudocode — full script lands in admin tooling
sqlite> SELECT aai_transcript_id FROM transcripts
        WHERE deleted_at IS NOT NULL AND aai_transcript_id IS NOT NULL;

# For each id, call AAI DELETE /v2/transcript/{id}
# Then DELETE FROM transcripts WHERE id IN (...) AND deleted_at IS NOT NULL;
```

---

## Phase 7 — launch

### 7.1 Production deploy

```sh
npm run deploy        # opennextjs-cloudflare build && deploy
```

### 7.2 Custom domain

Cloudflare Dashboard → Workers → `scribix` → **Custom Domains** → add `scribix.io`. DNS propagates in ~minutes.

### 7.3 Production env vars

Mirror everything from `.dev.vars` to Worker secrets. Use `wrangler secret put` for each (one prompt per secret):
```sh
npx wrangler secret put AUTH_SECRET
npx wrangler secret put GOOGLE_ID
npx wrangler secret put GOOGLE_SECRET
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler secret put CREEM_API_KEY
npx wrangler secret put CREEM_WEBHOOK_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put DISCORD_WEBHOOK_URL
```

Public/non-secret vars go in `wrangler.jsonc` under `vars`:
```jsonc
"vars": {
  "NEXT_PUBLIC_APP_URL": "https://scribix.io",
  "NEXTAUTH_URL": "https://scribix.io",
  "NEXT_PUBLIC_CREEM_ENV": "live",
  "ADMIN_EMAILS": "you@example.com",
  "CF_ACCOUNT_ID": "abc...",
  "ASSEMBLYAI_WEBHOOK_URL": "https://scribix.io/api/webhook/assemblyai"
}
```

### 7.4 First-time prod migration

```sh
npm run db:migrate:remote
```

---

## Quick reference: full env var list

Copy this template into `.env.local` and fill in (mirror to `.dev.vars`):

```
# next-auth (Phase 1)
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=
GOOGLE_ID=
GOOGLE_SECRET=

# AssemblyAI (Phase 2)
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_WEBHOOK_URL=http://localhost:3000/api/webhook/assemblyai
NEXT_PUBLIC_APP_URL=http://localhost:3000

# R2 presign (Phase 2)
CF_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# Creem (Phase 4)
CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
NEXT_PUBLIC_CREEM_ENV=test

# Admin / ops (Phase 6)
ADMIN_EMAILS=
DISCORD_WEBHOOK_URL=
```
