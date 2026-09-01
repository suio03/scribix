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

### 0.5 R2 lifecycle and media retention

Do not add a completed-media expiration rule. Media objects share the
`users/{userId}/{transcriptId}/` prefix with transcript JSON and translations,
so an R2 prefix lifecycle would also delete permanent transcript data.

The hourly cleanup worker deletes uploaded audio/video after 14 days and only
clears the database key after R2 confirms deletion. Keep the bucket's default
7-day abort rule for incomplete multipart uploads. Verify the current rules with
`npx wrangler r2 bucket lifecycle list scribix-media`.

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
CLOUDFLARE_ACCOUNT_ID=...        # from `wrangler whoami`
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

### 2.3 OpenAI API key for AI Notes and Ask AI (blocking)

1. https://platform.openai.com/api-keys → **Create new secret key**.
2. Copy the key.
3. Drop into `.env.local` and `.dev.vars`:
   ```
   OPENAI_API_KEY=...
   ```

For deployed environments, set the same secret on the Worker:
```sh
npx wrangler secret put OPENAI_API_KEY
```

The same key serves paid AI Notes and transcript Ask AI. Ask AI messages,
allowance counters, and token/cost usage events require D1 migrations `0022`
through `0024`; the Phase 0 migration commands apply them automatically.

### 2.4 Video source uploads

New video uploads always use multipart original-video upload. The source counts
against the plan's video storage allowance, creates a dormant video workspace
project, and remains available until that plan's source-retention deadline.
Audio files keep the single-upload transcription path. There is no browser-side
audio-extraction fallback for video files.

---

## Phase 3 — YouTube caption service

The in-app importer and Chrome, Edge, and Firefox extensions call the dedicated caption service;
the Scribix Worker does not download YouTube media itself. Configure the service
base URL and its shared bearer token in `.env.local` and `.dev.vars`:

```sh
YOUTUBE_CAPTION_SERVICE_URL=https://your-caption-service.example.com
YOUTUBE_CAPTION_SERVICE_TOKEN=...
```

Put `YOUTUBE_CAPTION_SERVICE_URL` in production `wrangler.jsonc` vars and store
the token as a Worker secret:

```sh
npx wrangler secret put YOUTUBE_CAPTION_SERVICE_TOKEN
```

`YOUTUBE_CAPTION_DEBUG=1` enables verbose service diagnostics. Do not enable it
in production unless actively investigating a caption-service failure.

### 3.1 Browser extension identity

Browser extensions authenticate through `app/api/extension/auth/*` with PKCE.
Apply migration `0021_extension_auth_tokens.sql` before deploying those routes.
Chrome uses the fixed published Web Store ID, and Firefox derives its redirect
from the manifest Gecko ID. Microsoft Edge requires its public Partner Center
CRX ID in production `wrangler.jsonc`:

```jsonc
"EDGE_EXTENSION_ID": "your-32-character-edge-extension-id"
```

The production deploy script rejects a missing or malformed Edge ID. If the
Partner Center listing changes, update this value and redeploy before testing
Edge sign-in. Build and publishing instructions live in
`docs/browser-extension-publishing.md`.

---

## Phase 4 — Paddle payments

Scribix uses Paddle Billing. New purchases offer Pro only: $20 monthly or
$120 yearly. Existing Starter subscriptions remain supported as a grandfathered
legacy tier. The app opens Paddle overlay checkout through Paddle.js and falls
back to Paddle's hosted checkout URL if Paddle.js is not initialized.

### 4.1 Products and prices

Create recurring Paddle prices for new Pro purchases, and retain the existing
Starter prices for grandfathered subscriptions:

- Pro monthly → `PADDLE_PRO_MONTHLY_PRICE_ID`
- Pro yearly → `PADDLE_PRO_YEARLY_PRICE_ID`
- Legacy Starter monthly → `PADDLE_BASIC_MONTHLY_PRICE_ID`
- Legacy Starter yearly → `PADDLE_BASIC_YEARLY_PRICE_ID`

Use Paddle price IDs (`pri_...`), not product IDs. The app maps legacy Starter
to internal tier `basic`. Do not remove its price IDs while grandfathered
subscriptions still exist, and do not expose them in new purchase UI.

### 4.2 Local env

Set in `.env.local` and `.dev.vars`:

```sh
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
NEXT_PUBLIC_PADDLE_ENV=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=...
PADDLE_BASIC_MONTHLY_PRICE_ID=pri_...
PADDLE_BASIC_YEARLY_PRICE_ID=pri_...
PADDLE_PRO_MONTHLY_PRICE_ID=pri_...
PADDLE_PRO_YEARLY_PRICE_ID=pri_...
```

### 4.3 Webhook destination

Create a Paddle notification destination:

- Local with ngrok: `https://abc123.ngrok.io/api/webhook/paddle`
- Production: `https://scribix.io/api/webhook/paddle`

Subscribe at minimum to:

- `transaction.completed`
- `subscription.activated`
- `subscription.updated`
- `subscription.canceled`
- `subscription.paused`
- `subscription.past_due`

Copy the notification destination secret to `PADDLE_WEBHOOK_SECRET`.

The company Paddle account may also deliver events for other products to this
destination. Scribix checkout transactions automatically write
`custom_data.project = "scribix"`. The webhook verifies the signature and then:

- acknowledges unsupported or foreign-project events without changing users;
- falls back to configured Scribix Price IDs for legacy events without project metadata;
- deduplicates owned events and failure alerts in the `paddle_events` table;
- retries owned payment, activation, and update events when their Price ID is unknown;
- still processes cancellation, pause, and past-due events identified by signed project metadata when their historical Price ID is no longer configured.

When rotating Price IDs, remember that legacy subscriptions created before project
metadata was added can only be identified by their configured Price ID. Keep their
ownership mapping available until those subscriptions have ended.

### 4.4 Production secrets and vars

Set production secrets:

```sh
npx wrangler secret put PADDLE_API_KEY
npx wrangler secret put PADDLE_WEBHOOK_SECRET
```

Set the public token and price IDs in `wrangler.jsonc` or Cloudflare dashboard
vars. Keep `NEXT_PUBLIC_PADDLE_ENV=production` for live Paddle credentials.

Configure Paddle Customer Portal to avoid unsupported self-service downgrades
until Scribix implements downgrade semantics in-app.

---

## Phase 6 — admin + ops

### 6.1 Admin allowlist

In `.env.local` and `.dev.vars`; for production, use the non-secret
`wrangler.jsonc` `vars` block:
```
ADMIN_EMAILS=you@example.com,teammate@example.com
```

### 6.2 Discord operational alerts (optional but recommended)

Create separate private Discord channels for errors and billing activity. In each
channel, open **Channel settings → Integrations → Webhooks → New Webhook**, then
set the corresponding URL:

```
DISCORD_ERROR_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_CHECKOUT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

- `DISCORD_ERROR_WEBHOOK_URL` should point to `error-tracking` and receives
  webhook and transcription failures.
- `DISCORD_CHECKOUT_WEBHOOK_URL` should point to `checkout-alerts` and receives
  payments, subscription changes, and other billing alerts.

User feedback must not share either webhook.

### 6.3 Discord feedback alerts (optional but recommended)

Create a separate private Discord channel such as `product-feedback`, then:

1. Channel settings → **Integrations** → **Webhooks** → **New Webhook**.
2. Name it `Scribix Feedback`.
3. Copy the webhook URL.
4. Set:
   ```
   DISCORD_FEEDBACK_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

### 6.4 Monthly AAI bulk-delete cron

Documented as a runbook (not code). Runs once a month:

```sh
# Pseudocode — full script lands in admin tooling
sqlite> SELECT aai_transcript_id FROM transcripts
        WHERE deleted_at IS NOT NULL AND aai_transcript_id IS NOT NULL;

# For each id, call AAI DELETE /v2/transcript/{id}
# Then DELETE FROM transcripts WHERE id IN (...) AND deleted_at IS NOT NULL;
```

### 6.5 Scheduled media cleanup Worker

Deploy the separate hourly Worker after its D1/R2 bindings are configured:

```sh
npm run deploy:cleanup
```

Scheduled cleanup does not need a secret. To enable its optional manual HTTP
trigger, set a dedicated key on the cleanup Worker and pass it as `?key=...`:

```sh
npx wrangler secret put CLEANUP_KEY --config wrangler.cleanup.jsonc
```

---

## Phase 7 — launch

### 7.1 Production deploy

```sh
npm run deploy        # locale validation + OpenNext build + deploy
```

This command validates all six locale files before the OpenNext build. Use the
package script rather than invoking `opennextjs-cloudflare` directly so locale
drift and invalid production public configuration cannot bypass the deploy
gate. `npm run build` and `npm run preview` enforce the same locale check.

### 7.2 Custom domain

Cloudflare Dashboard → Workers → `scribix` → **Custom Domains** → add `scribix.io`. DNS propagates in ~minutes.

### 7.3 Production env vars

Set server-only production credentials as Worker secrets (one prompt per secret):
```sh
npx wrangler secret put AUTH_SECRET
npx wrangler secret put GOOGLE_ID
npx wrangler secret put GOOGLE_SECRET
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put YOUTUBE_CAPTION_SERVICE_TOKEN
npx wrangler secret put PADDLE_API_KEY
npx wrangler secret put PADDLE_WEBHOOK_SECRET
npx wrangler secret put DISCORD_ERROR_WEBHOOK_URL
npx wrangler secret put DISCORD_CHECKOUT_WEBHOOK_URL
npx wrangler secret put DISCORD_FEEDBACK_WEBHOOK_URL
```

Public/non-secret vars go in `wrangler.jsonc` under `vars`:
```jsonc
"vars": {
  "NEXT_PUBLIC_APP_URL": "https://scribix.io",
  "NEXTAUTH_URL": "https://scribix.io",
  "EDGE_EXTENSION_ID": "your-32-character-edge-extension-id",
  "ADMIN_EMAILS": "you@example.com",
  "CLOUDFLARE_ACCOUNT_ID": "abc...",
  "ASSEMBLYAI_WEBHOOK_URL": "https://scribix.io/api/webhook/assemblyai",
  "YOUTUBE_CAPTION_SERVICE_URL": "https://your-caption-service.example.com",
  "NEXT_PUBLIC_PADDLE_ENV": "production",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN": "live_...",
  "PADDLE_BASIC_MONTHLY_PRICE_ID": "pri_...",
  "PADDLE_BASIC_YEARLY_PRICE_ID": "pri_...",
  "PADDLE_PRO_MONTHLY_PRICE_ID": "pri_...",
  "PADDLE_PRO_YEARLY_PRICE_ID": "pri_..."
}
```

### 7.4 Production migrations

Run this before every deployment that introduces unapplied migrations, not only
the first production setup:

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
# OpenAI (AI Notes + transcript Ask AI)
OPENAI_API_KEY=

# R2 presign (Phase 2)
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# YouTube caption service (Phase 3)
YOUTUBE_CAPTION_SERVICE_URL=
YOUTUBE_CAPTION_SERVICE_TOKEN=
YOUTUBE_CAPTION_DEBUG=0

# Paddle Billing (Phase 4)
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_ENV=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_BASIC_MONTHLY_PRICE_ID=
PADDLE_BASIC_YEARLY_PRICE_ID=
PADDLE_PRO_MONTHLY_PRICE_ID=
PADDLE_PRO_YEARLY_PRICE_ID=

# Admin / ops (Phase 6)
ADMIN_EMAILS=
DISCORD_ERROR_WEBHOOK_URL=
DISCORD_CHECKOUT_WEBHOOK_URL=
DISCORD_FEEDBACK_WEBHOOK_URL=
```
