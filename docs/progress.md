# Scribix v1 — Historical Implementation Plan

Reference architecture: `/Users/laughingli/Documents/side-projects/pixfy`. We borrow the patterns, polish what's worth polishing, and drop what doesn't apply to a transcription product.

This document is an archived v1 planning artifact. It preserves early design context, but it is not the current source of truth for implementation, billing, quotas, or operations. Prefer the code, `CLAUDE.md`, `docs/manual-setup.md`, and `docs/runbooks/` for current facts.

---

## 1. Locked decisions

| Area | Decision |
|---|---|
| Inputs (v1) | Upload + Record. |
| Pricing model | Subscription tiers (not credits). |
| Tiers | **Free**, **Basic**, **Pro** |
| Auth | Google OAuth + Google One-Tap (no email magic link, no Resend) |
| Transcript features | Plain text + word-level timestamps + speaker diarization + synced playback (7 days) + TXT/SRT/VTT export. Read-only viewer. |
| Hosting | Cloudflare Workers (via `@opennextjs/cloudflare`), single Next.js service. D1 + R2 bound directly. No separate Worker. |
| Speech models | Free → Universal-2. Basic + Pro → Universal-3 Pro with Universal-2 fallback (Option A: resubmit on language-unsupported error). |
| Payments | Creem (same as pixfy). |
| Quota cycle | Each Creem cycle event resets the bucket to full. No rollover. Yearly subscribers receive the full annual pool upfront. |
| Tier downgrades | Pro → Basic blocked at Creem portal level. Cancel-to-free remains self-service. |
| Audio retention | 7 days (R2 lifecycle), then deleted. Transcript JSON kept until user deletes. |
| Account deletion | Soft-delete via `deleted_at`. AAI-side cleanup is a separate admin-side bulk job (monthly cadence). |
| Launch posture | **v1.0 soft launch:** auth + Free tier only. Pricing UI hidden, `/api/billing/*` disabled, Creem webhook dormant. Paid tiers re-enabled in v1.1 once transcription quality is validated with real users. |

### Tier table

|  | Free | Basic | Pro Unlimited |
|---|---|---|---|
| Monthly price | $0 | $9 / mo | $19 / mo |
| Yearly price | — | $99 / yr (~$8.25/mo) | $179 / yr (~$14.92/mo) |
| Quota — monthly plan | 30 min / day | 600 min (10 hr) | 2,400 priority min (40 hr) + fair use |
| Quota — yearly plan | — | 7,200 min (120 hr) upfront | 28,800 priority min (480 hr) upfront + fair use |
| Per-file duration cap | 30 min | 2 hr | 10 hr (AssemblyAI ceiling) |
| Per-file size cap | 1 GB | 1 GB | 1 GB |
| Speech model | Universal-2 | Universal-3 Pro (+ U-2 fallback) | Universal-3 Pro (+ U-2 fallback) |
| Speaker labels | ✅ | ✅ | ✅ |
| Synced playback (7 days) + exports | ✅ | ✅ | ✅ |
| Priority queue | — | — | ✅ |

Margins (worst case, max usage, including diarization, at AAI ~$0.23/hr):
- Free **$0.085 / day** worst case per active user (30 min × $0.17/hr Universal-2 + diarization).
- Basic monthly: $2.30 vs $9 (3.9×).
- Pro monthly: $9.20 vs $19 (2.07×).
- Basic yearly: $27.60 cost vs $99 (3.59×, $71 profit).
- Pro yearly: $110.40 cost vs $179 (1.62×, $69 profit). Once Creem fees (~4%) and R2 egress are subtracted, real margin is closer to $55–60 before fair-use overage. Worth tracking yearly Pro usage closely once we have data.

**Marketing copy note:** for yearly tiers, do not say "minutes/month." Say "480 hr/year, available immediately, refreshed at renewal."

---

## 2. AssemblyAI constraints we're designing around

- `/v2/transcript` (URL-based, what we'll use): **1 GB**, **10 hours** max.
- `/v2/upload` is unused — R2 hosts the file, we pass AssemblyAI a signed R2 URL.
- Concurrency: paid AssemblyAI account = 200+ simultaneous jobs. Not a v1 bottleneck.
- AssemblyAI supports `webhook_url` on `POST /v2/transcript` with a custom auth header (`webhook_auth_header_name` / `webhook_auth_header_value`) — **we use webhook callbacks, not client polling against AssemblyAI**. Client polls our own DB instead.
- AAI **retries failed webhook deliveries**. Handlers must be idempotent (see §9.2).

---

## 3. Architecture

Single service on Cloudflare Workers via the OpenNext Cloudflare adapter (`@opennextjs/cloudflare`). Workers IS edge runtime, so no per-route `runtime = 'edge'` annotation is needed — every route runs at the edge by default. `nodejs_compat` is enabled in `wrangler.jsonc` so we can opt into Node stdlib if a library needs it.

```
                       ┌─────────────────────────────────────────────┐
                       │   Next.js (Cloudflare Workers, OpenNext)     │
 user / browser ──────▶│   marketing pages, dashboard, /api/*         │
                       │   D1 binding: DB                             │
                       │   R2 binding: SCRIBIX_MEDIA                  │
                       │   ASSETS binding: static assets              │
                       └─────────────────────────────────────────────┘
                                  │ ▲                  │ ▲
              POST /v2/transcript │ │ webhook callback │ │ webhook
                                  ▼ │                  ▼ │
                      ┌──────────────────┐    ┌──────────────────┐
                      │   AssemblyAI     │    │      Creem       │
                      └──────────────────┘    └──────────────────┘
```

- Next.js app handles UI, auth, all `/api/*` route handlers, AssemblyAI submission, Creem checkout, webhook receivers.
- D1 and R2 are bound directly to the Worker via `wrangler.jsonc`. Bindings accessed via `getCloudflareContext()` from `@opennextjs/cloudflare`. No separate service, no inter-service bearer auth.

Why Workers + OpenNext (vs the original Pages plan):
- `@cloudflare/next-on-pages` was deprecated in favor of `@opennextjs/cloudflare` as Cloudflare consolidates Pages into Workers.
- Workers gives broader Next.js feature parity (ISR via KV, image optimization works, `nodejs_compat` available).
- Same D1 + R2 bindings, same edge execution model — all the architectural decisions from the original plan still apply.

Why no separate Worker (vs pixfy):
- Bindings work directly inside the same Worker — the original reason pixfy split (clean bindings on Pages) doesn't apply.
- Inter-service hops add latency and another secret to manage (`API_SECRET`).
- Webhook reliability is solved by handler idempotency + inline reconcile (§9.3), not by a second service.

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | bumped to 16.x for OpenNext compat |
| i18n | next-intl | already in repo |
| Auth | next-auth v5 + Google provider | lift from pixfy |
| DB | Cloudflare D1 (SQLite) | bound to the Worker as `DB` |
| Storage | Cloudflare R2 | bucket `scribix-media`, bound to the Worker as `SCRIBIX_MEDIA` |
| Payments | Creem REST API | edge-compatible client lifted from pixfy |
| Transcription | AssemblyAI (Universal-2 / Universal-3 Pro) | URL-based + webhook |
| Runtime | Cloudflare Workers (via `@opennextjs/cloudflare`) | implicit edge — no per-route annotation |
| Email | none in v1 | Creem sends its own receipts |
| Analytics | next-intl + light server-event logger | port pixfy's `server-analytics.ts` lazily |

---

## 5. Database schema (D1)

Single migration file `migrations/0001_initial.sql`. No `daily_free_quota_table`, no credit ledger.

```sql
-- Users
CREATE TABLE users (
  id              TEXT PRIMARY KEY,                 -- Google profile.sub
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  country         TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Subscription state (single source of truth, no credit ledger)
  tier                   TEXT NOT NULL DEFAULT 'free',     -- 'free' | 'basic' | 'pro'
  billing_cycle          TEXT,                              -- 'monthly' | 'yearly' | null
  customer_id            TEXT,                              -- Creem customer
  product_id             TEXT,                              -- current Creem product (null on free)
  subscription_status    TEXT,                              -- 'active' | 'canceled' | 'expired' | null

  -- Quota counter (single counter, full reset on each Creem cycle event)
  minutes_used_this_period   INTEGER NOT NULL DEFAULT 0,
  period_started_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  period_ends_at             DATETIME,                      -- next quota reset (Creem current_period_end for paid; +1d for free)

  -- Engagement tracking (post-launch targeted-discount signals; see §14 Phase 8)
  total_minutes_lifetime     INTEGER NOT NULL DEFAULT 0,
  total_files_lifetime       INTEGER NOT NULL DEFAULT 0,
  active_days_count          INTEGER NOT NULL DEFAULT 0,    -- distinct calendar days the user submitted a job
  last_active_at             DATETIME,
  hit_daily_cap_count        INTEGER NOT NULL DEFAULT 0,    -- bumped on `no_quota` reservation reject — strongest upgrade signal

  -- Soft delete
  deleted_at      DATETIME

  -- Optional admin flag
  -- is_admin     INTEGER DEFAULT 0
);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_customer_id ON users(customer_id);

-- Transcripts (jobs)
CREATE TABLE transcripts (
  id                    TEXT PRIMARY KEY,            -- our UUID
  user_id               TEXT NOT NULL REFERENCES users(id),
  title                 TEXT NOT NULL,               -- defaults to filename, user-renamable
  status                TEXT NOT NULL DEFAULT 'pending',
                                                     -- 'pending'|'uploading'|'queued'|'processing'|'completed'|'error'
  source                TEXT NOT NULL,               -- 'upload' | 'record'

  -- Files in R2
  audio_r2_key          TEXT,                        -- audio/{user_id}/{id}/source.{ext}; nullable after 7d auto-delete
  transcript_r2_key     TEXT,                        -- transcripts/{user_id}/{id}.json

  -- Audio metadata (filled at submit; finalized at completion)
  filename              TEXT,
  mime_type             TEXT,
  bytes                 INTEGER,
  duration_sec          INTEGER,                     -- final billed duration (capped by audio_end_at)
  reserved_minutes      INTEGER,                     -- minutes pre-deducted at submit; reconciled to actual at completion

  -- AssemblyAI handles
  speech_model          TEXT NOT NULL,               -- the model the transcript settled on after fallback
  language              TEXT,                        -- detected by AssemblyAI
  aai_transcript_id     TEXT,                        -- AssemblyAI's id
  webhook_token         TEXT NOT NULL,               -- per-job secret, validated on incoming webhook
  error                 TEXT,

  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME,
  deleted_at            DATETIME                     -- soft delete
);
CREATE INDEX idx_transcripts_user_created  ON transcripts(user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_status        ON transcripts(status);
CREATE INDEX idx_transcripts_aai_id        ON transcripts(aai_transcript_id);

-- Webhook event dedup (Creem)
CREATE TABLE processed_creem_events (
  event_id     TEXT PRIMARY KEY,
  received_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Why no `topup_credits`, `daily_free_quota`, `credit_usage_logs` tables (pixfy has all three): subscription tiers with full-bucket resets on each Creem cycle event are sufficient. One field, `minutes_used_this_period`. R2 lifecycle is the sole truth for audio expiry — no `expires_at` column.

---

## 6. R2 bucket layout

Single bucket: `scribix-media`.

```
audio/{user_id}/{transcript_id}/source.{ext}      ← original upload, deleted 7 days after upload
transcripts/{user_id}/{transcript_id}.json        ← AssemblyAI completion payload, kept until user deletes
```

- Audio is private, served via signed URL only when AssemblyAI fetches or the user plays back in-browser.
- Transcript JSON is private, fetched server-side only to render the viewer or generate exports.
- **Lifecycle rule on `audio/` prefix: delete 7 days after upload.** Sole authority for audio expiry.
- We **do not** store SRT/VTT — generate from JSON on download.
- **CORS:** the bucket needs `PUT` allowed from `https://scribix.io` (and any preview origins) so the direct-to-R2 upload works.
- Synced playback only works while the audio is alive (≤ 7 days). After expiry, the viewer shows "audio expired, transcript only" and disables the playback control.

---

## 7. Auth flow (next-auth v5 + Google)

1. **Two entry paths, one upsert:**
   - **Primary (One-Tap):** Google Identity Services renders an inline prompt for unauthenticated visitors on home / dashboard. The returned ID token POSTs to `/api/auth/onetap`, which verifies via Google's `tokeninfo` endpoint, upserts the user row, and mints a next-auth-compatible JWT cookie.
   - **Fallback (redirect):** standard next-auth Google OAuth (Header "Sign in" button). Used when One-Tap is dismissed, the user is in incognito, FedCM is disabled, or an ad-blocker silences the prompt.
2. Both paths run the same D1 upsert keyed on `profile.sub` (no inter-service hop — direct D1 binding).
3. New users get `tier='free'`, `period_ends_at = now + 1 day` (free quota is a daily-rolling window).
4. JWT carries `id`, `tier`, `minutes_used_this_period`, `period_ends_at` (refreshed on token rotation).

Admin gating: env var `ADMIN_EMAILS=a@x.com,b@x.com`. `auth()` helper enriches session with `isAdmin` boolean. No DB column needed.

---

## 8. Subscription / Creem integration

### 8.1 Plans config (`config/plans.ts`)

```ts
export const PLANS = {
  free:  { tier: 'free',  minutesPerCycle: 30,    maxFileSec: 30 * 60,    maxFileBytes: 1 * 1024 * 1024 * 1024 },
  basic: {
    tier: 'basic',
    monthly: { minutesPerCycle: 600,  creem: 'prod_xxx_basic_monthly' },
    yearly:  { minutesPerCycle: 7200, creem: 'prod_xxx_basic_yearly'  },
    maxFileSec: 2 * 3600,
    maxFileBytes: 1 * 1024 * 1024 * 1024,
  },
  pro: {
    tier: 'pro',
    monthly: { minutesPerCycle: 2400,  creem: 'prod_xxx_pro_monthly' },
    yearly:  { minutesPerCycle: 28800, creem: 'prod_xxx_pro_yearly'  },
    maxFileSec: 10 * 3600,
    maxFileBytes: 1 * 1024 * 1024 * 1024,
  },
} as const;
```

### 8.2 Routes

| Route | What it does |
|---|---|
| `POST /api/billing/checkout` | Creates Creem checkout for `{ tier, cycle }`, redirects user. |
| `POST /api/billing/portal` | Creates Creem customer portal link (configured to **disable plan-switching**; only "cancel" and "billing details" exposed). |
| `POST /api/webhook/creem` | Receives Creem events, updates user row. |

### 8.3 Webhook events handled

Every event is dedup'd by `event_id` against `processed_creem_events` before any side effect.

| Creem event | Detection rule | Action |
|---|---|---|
| `checkout.completed` | first paid checkout | Set `tier`, `billing_cycle`, `customer_id`, `product_id`, `subscription_status='active'`. **Reset `minutes_used_this_period=0`.** Set `period_ends_at = current_period_end`. |
| `subscription.updated` — **renewal** | incoming `current_period_end` > stored | **Reset `minutes_used_this_period=0`.** Set `period_ends_at = current_period_end`. Tier unchanged. |
| `subscription.updated` — **plan change** (e.g. basic→pro mid-cycle) | tier or `billing_cycle` changed, `current_period_end` unchanged | Update `tier`, `billing_cycle`, `product_id`. **Keep counter.** Higher tier's caps apply going forward. |
| `subscription.canceled` | user cancelled, retains access until period end | Mark `subscription_status='canceled'`. Keep tier and counter until `period_ends_at`. |
| `subscription.expired` | grace period over | Set `tier='free'`, `billing_cycle=null`, `subscription_status='expired'`, `minutes_used_this_period=0`, `period_ends_at = now + 30 days`. |
| `payment.failed` | dunning event | Log + Discord alert. No tier change (Creem dunning handles retries). |

**Pro → Basic downgrade is blocked at the Creem portal config.** If a `subscription.updated` arrives that would reduce tier (e.g. from a path we didn't expect), log a Discord alert and refuse — do not change `tier` downward.

**Lift from pixfy unchanged:** `lib/creem.ts` (Web Crypto HMAC verification — already edge-compatible). `findPlanByProductId` lookup pattern.

**Polish vs pixfy:** drop `topup_credits`/credit-grant logic. Subscription cycle = quota cycle = billing cycle. One source of truth.

---

## 9. Transcription pipeline (the core flow)

End-to-end: **5 hops**, all edge-runtime.

```
[1] Browser:  POST /api/transcripts/init  { filename, bytes, mime }
              → server validates tier file-size cap, creates transcript row (status='pending'),
                returns { transcriptId, presignedUploadUrl }   (TTL 24h)
[2] Browser:  PUT presignedUploadUrl  (direct to R2; bypasses Pages' 100 MB body cap)
[3] Browser:  POST /api/transcripts/{id}/start  { duration_sec_estimate }
              → server reserves quota atomically (see §10),
                computes audio_end_at = remaining_minutes * 60_000,
                calls AssemblyAI POST /v2/transcript with:
                  - audio_url: signed R2 URL (24h TTL)
                  - audio_end_at: server-computed cap (so AAI bills only up to remaining quota)
                  - speech_model: tier-dependent (universal-3-pro for paid; universal-2 for free)
                  - speaker_labels: true
                  - language_detection: true
                  - webhook_url: https://scribix.io/api/webhook/assemblyai
                  - webhook_auth_header_name: X-Scribix-Token
                  - webhook_auth_header_value: <per-job token, stored in row>
                stores aai_transcript_id, marks status='queued'.
[4] AssemblyAI → POST /api/webhook/assemblyai
              → idempotent handler (see §9.2),
                fetches full transcript JSON, writes to R2,
                updates transcripts row: status='completed', duration_sec, language,
                  reconciles users.minutes_used_this_period to actual.
[5] Browser:  poll GET /api/transcripts/{id}/status (cheap, our DB only) every 3s.
              The status endpoint also runs an inline reconcile if the row has been
              queued/processing for >15 min (see §9.3).
```

### 9.1 Why webhooks (not client polling AssemblyAI)
- 1 webhook hit vs ~30 polls per job (5-min job @ 3s polling).
- Saves Pages function invocations.
- Faster end-to-end (webhook fires within seconds of completion).

### 9.2 Webhook security + idempotency

**Auth:** AssemblyAI passes back `X-Scribix-Token`. Validate against the row's stored `webhook_token`. Reject 401 on mismatch.

**Idempotency (load-bearing — AAI retries 5xx).** All state mutations on completion go through one atomic guard:

```sql
UPDATE transcripts
   SET status = 'completed',
       duration_sec = ?,
       language = ?,
       transcript_r2_key = ?,
       speech_model = ?,
       completed_at = CURRENT_TIMESTAMP
 WHERE id = ?
   AND status NOT IN ('completed', 'error');
```

If `affected_rows = 1`: it's the first delivery → write transcript JSON to R2 and reconcile usage (§10). If `affected_rows = 0`: duplicate or already-reconciled by `/status` inline reconcile → return 200, do nothing. Same shape applies to error-state transitions.

**Creem webhook idempotency:** every event is dedup'd by `event_id` against `processed_creem_events` before any side effect. INSERT then proceed; ON CONFLICT, return 200.

### 9.3 Inline reconcile (replaces a standalone cron)

`GET /api/transcripts/[id]/status` and the dashboard list endpoint each run this check before returning:

```
For rows where status IN ('queued','processing') AND created_at < now - 15min:
  GET https://api.assemblyai.com/v2/transcript/{aai_id}
  if AAI says completed → run the same atomic guard from §9.2
  if AAI says error     → mark error
```

This catches transcripts whose webhook was lost (mid-rollout deploy, handler crash, AAI delivery glitch). No standalone Worker, no scheduled handler. The check fires only when a user is actively waiting on the result, which is exactly when it matters.

A user who closes the tab and never returns will see the reconcile fire the next time they open the dashboard list.

### 9.4 Audio extraction from video

AssemblyAI accepts video (MP4/MOV/WebM) directly and pulls the audio track itself. We don't run FFmpeg. Cost: bigger R2 storage for video files — acceptable with the 7-day audio lifecycle.

### 9.5 Recording flow

- MediaRecorder API in browser (WebM/Opus output).
- After stop: client encodes blob → same `init → presigned upload → start` pipeline as upload.
- Max recording length enforced client-side per tier; the server-side `audio_end_at` cap is the actual safety net.

### 9.6 Speech model fallback (Option A)

`speech_model` is a single-value field on AAI's submit endpoint — no native multi-model fallback. We implement fallback ourselves:

1. Submit with `universal-3-pro` for Basic / Pro tiers.
2. If AAI's completion payload reports an unsupported-language error (or returns an explicit fallback signal), the webhook handler resubmits the same `audio_url` with `speech_model='universal-2'`.
3. The `transcripts.speech_model` column records the model that **actually completed**, not the one originally requested.
4. Track fallback rate via Discord alerts on resubmission so we can tune the supported-language list later.

If the first-pass submission failed before billing, we eat no AAI cost on the fallback. If AAI did bill the failed Universal-3-Pro pass, that's an edge cost we'll measure post-launch.

---

## 10. Quota enforcement

Three checkpoints. **Client-supplied duration is never trusted** — it's a UX hint only.

### 10.1 Upload init (`/api/transcripts/init`)
Reject with 413 if `bytes > tier.maxFileBytes`. No storage work performed.

### 10.2 Submit start (`/api/transcripts/[id]/start`) — atomic reservation

```sql
UPDATE users
   SET minutes_used_this_period = minutes_used_this_period + ?reserved
 WHERE id = ?
   AND deleted_at IS NULL
   AND minutes_used_this_period + ?reserved <= ?cap;
```

- `?reserved = min(ceil(duration_sec_estimate / 60), tier.minutesPerCycle - minutes_used)` — i.e. reserve at most the user's remaining quota.
- If `affected_rows = 0`, reject 429 — quota would be exceeded.
- Persist `reserved_minutes` on the transcripts row so we can reconcile precisely on completion.
- Compute `audio_end_at = reserved_minutes * 60 * 1000` and pass it on the AAI submit. AAI will only transcribe (and only bill us) up to that point. A user uploading a 10 hr file with 30 min remaining will get 30 min of transcript and the rest cut off cleanly.

If the user's remaining quota is below a reasonable threshold (e.g. < 50% of the estimate), we reject up-front rather than half-transcribing. UX message: "This file is longer than your remaining quota — upgrade or wait for the next cycle."

### 10.3 Webhook completion (reconcile)
The webhook handler reconciles the reservation to actual:

```sql
UPDATE users
   SET minutes_used_this_period = minutes_used_this_period - ?reserved + ?actual
 WHERE id = ?
   AND deleted_at IS NULL;
```

`?actual = ceil(duration_sec / 60)`. Because `audio_end_at` capped the AAI billing, `actual ≤ reserved` is guaranteed in the over-quota case. The atomic guard from §9.2 ensures this runs at most once per transcript.

### 10.4 Period reset
Period reset is event-driven (Creem webhook), not lazy:
- On `checkout.completed`, `subscription.updated` (renewal detected), and `subscription.expired`, the counter is set to 0 explicitly. See §8.3.
- For free users (no Creem coupling), `period_ends_at` is a self-rolling **1-day** window. On any read of the user row where `now() >= period_ends_at`, lazy-reset:
  ```
  minutes_used_this_period = 0
  period_started_at = period_ends_at
  period_ends_at    = period_started_at + 1 day
  ```
  The race on lazy reset (two concurrent reads at the boundary) is harmless — both writes converge on the same end state.

---

## 11. API routes inventory

All routes run on Cloudflare Workers (edge) by default — no per-route runtime annotation.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | * | next-auth handlers |
| `/api/transcripts/init` | POST | tier check + create row + presign R2 upload |
| `/api/transcripts/[id]/start` | POST | atomic quota reservation + submit to AssemblyAI |
| `/api/transcripts/[id]/status` | GET | poll endpoint (DB read + inline reconcile) |
| `/api/transcripts/[id]` | GET | fetch transcript JSON for viewer |
| `/api/transcripts/[id]` | DELETE | delete row + R2 keys (audio + JSON) |
| `/api/transcripts/[id]` | PATCH | rename |
| `/api/transcripts/[id]/export` | GET `?format=txt\|srt\|vtt` | format on the fly from JSON |
| `/api/transcripts/[id]/media` | GET | signed R2 URL for the original audio (synced playback, only ≤ 7 days) |
| `/api/account` | DELETE | soft-delete user + cascade soft-delete all transcripts + remove R2 keys |
| `/api/webhook/assemblyai` | POST | AssemblyAI completion callback (idempotent, see §9.2) |
| `/api/webhook/creem` | POST | Creem subscription events (dedup'd by event_id) |
| `/api/billing/checkout` | POST | start Creem checkout |
| `/api/billing/portal` | POST | open Creem customer portal |
| `/api/admin/users` | GET | admin list |
| `/api/admin/transcripts` | GET | admin list |
| `/api/admin/users/[id]` | PATCH | admin grant/revoke tier |

`DELETE /api/transcripts/[id]` and `DELETE /api/account` only touch our R2 + D1. AssemblyAI-side cleanup is a separate **admin-side bulk job** that runs monthly: collects all `aai_transcript_id` for soft-deleted rows, batch-DELETEs against AAI, then hard-deletes the rows. This satisfies GDPR Article 17's "without undue delay" with a defined cadence.

---

## 12. Lift-from-pixfy vs polish

### 12.1 Lift unchanged
- `lib/creem.ts` — Web Crypto HMAC verification, REST client.
- `lib/next-auth.ts` skeleton — Google provider, JWT callbacks.
- Discord error alerting (`lib/discord.ts`) — useful day one.
- `lib/report-error.ts` shape.
- Admin gating via env email allowlist.

### 12.2 Polish (what we change and why)

| Pixfy pattern | Why it doesn't fit Scribix | What we do instead |
|---|---|---|
| Two-service split (Next.js + D1/R2 Worker) + bearer-token API | Workers (via OpenNext) handles bindings cleanly in the same service. The split was historical, not architectural. | Single Worker with D1 + R2 bindings. No `API_SECRET`. |
| `users.credits`, `users.topup_credits`, `daily_free_quota_table` | Three counters for a credit economy | Single `minutes_used_this_period` + cycle-event reset |
| `migration-add-topup-credits.sql`, `migration-add-credit-usage-logs.sql` | Credit ledger overhead | No equivalent |
| Pre-flight content moderation on prompts/images | Transcription has no generative prompt | Drop. Handle abuse via post-hoc reports + `is_banned` flag if needed later |
| `translatePromptIfNeeded` (OpenAI translate) | Not relevant | Drop |
| Base64 image upload through Worker | Audio/video files exceed 100 MB request body cap | **Direct-to-R2 presigned PUT** from browser |
| Client polling AssemblyAI/Replicate | We control the endpoint pair | **Webhook callbacks** with idempotent handlers; client polls our DB; inline reconcile on `/status` |
| Multiple billing/account/usage pages | Ours has 2 paid tiers and 1 metric | **Single `/dashboard/account` page** |
| `pixfy-db` schema partly commented out | Schema-by-migration drift | Schema-as-code with numbered migrations from day one |
| Trust client-supplied numeric inputs (durations, sizes) on quota math | Audio duration from `<audio>` metadata is trivially patchable | **Server-side `audio_end_at` cap** on AAI submit; AAI enforces the ceiling |

---

## 13. Out of scope for v1 (deferred / nice-to-have)

| | Why deferred |
|---|---|
| Email notifications (job complete, billing reminders) | No email infra in v1; users see status via dashboard |
| External video URL transcription | Deferred; external extractors are not part of the product. |
| In-browser transcript editing | Days of frontend scope (autosave, undo, conflict) |
| Additional rich export formats | TXT/SRT/VTT covers 95% of users |
| Public share links | Adds permission model + abuse vector |
| Summarization / chapters / sentiment (LeMUR) | Upsell features for v2 |
| Translation of transcripts | Upsell feature for v2 |
| Folders / tags / search | Date-sorted list works until users have 50+ items |
| Team / workspace | Single-seat tiers in v1 |
| API access for Pro users | Marketed in pricing as future-ready; built v2 |
| Audio extraction server-side | AssemblyAI handles video natively |
| Admin panel UI beyond list views | CLI/SQL is enough until we have real users |
| AAI-side per-delete API call | Replaced by monthly admin-side bulk delete |

---

## 14. Build phases (suggested order)

Each phase ends in something demonstrable.

### Phase 0 — repo bootstrap (½ day) — ✅ done (commit `3d47224`)
- [x] `@opennextjs/cloudflare` adapter installed; `wrangler.jsonc` declares D1 + R2 bindings.
- [x] Migration `0001_initial.sql` (schema in §5).
- [x] Local dev: `next dev` (with `initOpenNextCloudflareForDev()` exposing bindings) or `npm run preview` for full Worker emulation.
- [x] Env vars table established (see §15).
- [ ] R2 bucket CORS configured for direct browser PUT. *(deferred — manual step before launch, see §16)*

### Phase 1 — auth + user shell (1 day) — ✅ done (commit `66c0214`)
- [x] next-auth v5 + Google.
- [x] `signIn` callback → D1 upsert (direct binding).
- [x] Header/dashboard auth gate.
- [x] `/dashboard` skeleton (empty list).
- [x] `/dashboard/account` showing email + tier + usage (mocked).

### Phase 2 — transcription pipeline, single tier (2–3 days) — ✅ done (commit `a77305d`)
- [x] Hardcode everyone to "free" tier; ignore Creem entirely.
- [x] Upload → R2 presign → AssemblyAI submit → idempotent webhook → completion.
- [x] Read-only viewer with synced playback.
- [x] TXT export.
- [x] Inline reconcile on `/status`.

### Phase 3 — record tab + exports (1 day) — ✅ done (commit `a77305d`)
- [x] MediaRecorder client flow into the same pipeline.
- [x] SRT, VTT export endpoints.

### Phase 4 — payments (1–2 days) — ✅ done (commit `391f2ad`)
- [x] Creem products (basic monthly/yearly, pro monthly/yearly). *(env-driven product IDs; real IDs to be filled in dashboard)*
- [x] Checkout + portal routes (portal config disables plan-switching). *(portal toggle is a Creem-side config — see §16)*
- [x] Webhook handler with all 5 event types + `event_id` dedup + cycle-detection logic from §8.3.
- [x] Pricing page wires to checkout.

### Phase 5 — quota enforcement (1 day) — ✅ done (commit `c534eee`)
- [x] Atomic reservation at `/start` (`lib/quota.ts:reserveQuota`).
- [x] `audio_end_at` cap on AAI submit (`start/route.ts`).
- [x] Reconciliation in webhook completion (success + error paths in `webhook/assemblyai/route.ts`).
- [x] 402 / 413 / 429 error UX — split `no_quota` (429) vs `insufficient_quota` (402, remaining < estimate/2 per §10.2); 413 for size/duration tier caps; friendly messages in `Uploader.readError`.
- [x] Speech model fallback (§9.6) — wired via AAI's native `speech_models` array (`["universal-3-pro", "universal-2"]` for paid tiers); `transcripts.speech_model` records the model that actually completed.

### Phase 6 — admin + ops (1 day) — ✅ done (commit `c534eee`)
- [x] Admin list pages (users + transcripts) — gated by `ADMIN_EMAILS` (`lib/admin.ts`); paginated lists at `/admin/users` and `/admin/transcripts` with search/filter and "include deleted" toggle.
- [x] Discord error alerts — added `transcription_failed` and `account_deleted` kinds; wired AAI submit failure (`start/route.ts`), AAI-side error completion + bad webhook token (`webhook/assemblyai/route.ts`), and account deletion.
- [x] Account-delete endpoint — `DELETE /api/account` soft-deletes user + cascade-soft-deletes transcripts + bulk-removes R2 audio + transcript JSON; UI in `DeleteAccountButton` on `/dashboard/account`.
- [x] Runbook for monthly AAI bulk-delete (`docs/runbooks/aai-bulk-delete.md`) — purges AAI for soft-deleted rows, then hard-deletes the D1 rows + orphaned users.

### Phase 7 — polish + launch prep (1–2 days) — ✅ done
- [x] Empty states, loading states, error states — viewer shows "Audio expired" panel for completed rows older than 7 days; dashboard shows checkout-success banner on `?checkout=ok`. Existing list/processing/error states already in place from earlier phases.
- [x] Pricing page copy — yearly bullets now read "available immediately, refreshed at renewal" matching §1 marketing copy note.
- [x] Refund policy page (`/refunds`) — Paddle-aligned 14-day refund request window with no usage-based qualifiers. Terms (`/terms`) and Privacy (`/privacy`) stubbed alongside; footer links updated.
- [x] Marketing site SEO — fixed `metadataBase` (`scribix.app` → `scribix.io`); added `app/robots.ts`, `app/sitemap.ts` (locale-alternate aware), and JSON-LD (Organization + WebSite + SoftwareApplication) on the home page.
- [x] Production deployment — `docs/runbooks/launch-checklist.md` ties together prod webhook flip (Creem dashboard), §16 open items, and day-1 monitoring. Manual-setup §7 already covers Worker secrets + custom domain.

### Phase 8 — Soft-launch retrofit (½ day) — pending

Pre-launch posture: ship auth + Free tier only, defer paid path until transcription quality is validated with real users. **Does not delete Phase 4–6 code** — gates the UI surface and disables billing routes so paid is one config flip away.

- [ ] **Free tier → daily window.** `lib/plans.ts` Free `minutesPerCycle` stays 30; `lib/quota.ts:maybeResetFreePeriod` and `auth.ts` upsert change `'+30 days'` → `'+1 day'`. No migration needed (column shapes unchanged).
- [ ] **Engagement tracking.** Migration `0002_engagement.sql` adds `total_minutes_lifetime`, `total_files_lifetime`, `active_days_count`, `last_active_at`, `hit_daily_cap_count` to `users`. `lib/quota.ts:reconcileQuota` bumps lifetime + active-day stats on completion; `reserveQuota` bumps `hit_daily_cap_count` when it returns `no_quota`.
- [ ] **Google One-Tap.** Add Google Identity Services script (`gsi/client`) in root layout. New `<GoogleOneTap />` client component renders on home + dashboard when `!signedIn` and calls `google.accounts.id.prompt()`. New route `app/api/auth/onetap/route.ts` verifies the ID token (Google `tokeninfo` endpoint), upserts the user row (same logic as `auth.ts:32-46`), mints a next-auth-compatible JWT cookie. Standard Sign in button stays as fallback.
- [ ] **Hide pricing surface.** Remove `<Pricing />` from `app/[locale]/page.tsx:81`. Drop `AggregateOffer` from JSON-LD (`app/[locale]/page.tsx:44-50`). Drop pricing footer link from `messages/en.json` `Footer.legal`.
- [ ] **Disable checkout / portal.** `/api/billing/checkout` + `/api/billing/portal` return 404. `/dashboard/account` hides the "Upgrade" CTA + `<BillingPortalButton />` (keep usage display). Creem webhook handler stays mounted — no-op without checkouts.
- [ ] **Launch checklist split.** Carve `docs/runbooks/launch-checklist.md` Creem smoke tests + portal config into a "v1.1" section. v1.0 list is auth + free-tier transcription smoke tests only.

**Total estimate: ~9–11 working days for a single dev.** (Phase 8 adds ~½ day on top.)

---

## 15. Environment variables / secrets

### Pages project (`.env.local` / Pages secrets)
```
NEXTAUTH_URL=
AUTH_SECRET=
GOOGLE_ID=
GOOGLE_SECRET=

ASSEMBLYAI_API_KEY=
OPENAI_API_KEY=

CREEM_API_KEY=
NEXT_PUBLIC_CREEM_ENV=test|prod
CREEM_WEBHOOK_SECRET=

ADMIN_EMAILS=                      # comma-separated allowlist
DISCORD_WEBHOOK_URL=               # optional, for error alerts
```

### Pages bindings (`wrangler.jsonc`)
```
D1 binding: DB                     # database scribix-db
R2 binding: SCRIBIX_MEDIA          # bucket scribix-media
```

No `WORKER_URL`, no `API_SECRET` — single service.

---

## 16. Open items to confirm before launch

These don't block the architecture but block coding / launch:

1. **Refund policy.** Paddle requires a 14-day refund request window without usage-based qualifiers; keep `/refunds` aligned with Paddle's current refund policy.
2. **Creem portal config.** Confirm plan-switching is disabled (only "cancel" + "billing details" exposed) so the Pro → Basic block is enforced at the source.
3. **Cloudflare account.** New project under the Scribix account.
4. **AAI bulk-delete cadence.** Monthly is recommended. Document it as a runbook.
5. **R2 CORS.** PUT allowed from `https://scribix.io` and any preview origins.
6. **Recording max length on Free tier.** 30 min cap mirrors the Free quota — confirm.

Resolved / no longer questions:
- Domain: `scribix.io`
- Free tier email verification: Google OAuth is sufficient
- Creem account: new account; product IDs as placeholders during dev
- Yearly billing in v1: yes, both monthly and yearly
- Yearly price: Basic $99/yr, Pro $179/yr
- Concurrent sessions: no limit in v1

---

## Changelog (post-challenge)

This plan was rewritten on 2026-04-29 after a ten-question challenge pass. Key changes from the original:

1. **Two-service split deleted.** Single Pages app with D1 + R2 bindings. (§3, §4, §7, §11, §12, §15)
2. **Cron deleted.** Replaced with inline reconcile on `/status` and the dashboard list. (§9.3)
3. **Quota enforcement is server-side.** Server computes `audio_end_at` from remaining quota and passes it on the AAI submit. Atomic conditional UPDATE for reservation. Client duration is never trusted. (§10)
4. **Signed R2 URL TTL bumped to 24h.** (§9 step 3)
5. **Subscription model clarified.** Each Creem cycle event resets the bucket to full; yearly buyers get the full annual pool upfront. Pro→Basic blocked at portal level. (§1, §8.3)
6. **Audio retention 30d → 7d.** Synced playback gated to that window; viewer needs an "expired" state. (§6)
7. **Account deletion designed in.** `deleted_at` soft-delete on users + transcripts. `DELETE /api/account` endpoint. AAI-side cleanup is a monthly admin bulk job. (§5, §11)
8. **`expires_at` column dropped.** R2 lifecycle is the sole authority for audio expiry. (§5)
9. **Speech model fallback (Option A).** Submit with U3P; on language error, webhook resubmits with U2. `speech_model` column tracks the actual model used. (§9.6)
10. **Webhook idempotency formalized.** AAI: atomic UPDATE with status guard. Creem: `event_id` dedup table. (§9.2, §5)
11. **Hosting: Pages → Workers via OpenNext.** `@cloudflare/next-on-pages` was deprecated in favor of `@opennextjs/cloudflare`. Same D1 + R2 bindings, same edge model. `runtime = 'edge'` annotations dropped — Workers IS the runtime. Next.js bumped to 16.x for OpenNext peer compat. (§3, §4, §11, §14)

### 2026-05-02 — Soft-launch retrofit

12. **v1.0 launch posture.** Ship auth + Free tier only. Pricing UI hidden, `/api/billing/checkout` + `/portal` return 404, Creem webhook handler stays mounted but dormant. Paid path re-enabled in v1.1 after quality is validated with real users. (§1 launch posture, §14 Phase 8)
13. **Free tier: 30 min / 30 days → 30 min / day.** Daily-rolling window matches industry default and gives users a "real workflow" daily quota instead of a one-shot monthly sample. `lib/quota.ts:maybeResetFreePeriod` and `auth.ts` upsert change `'+30 days'` → `'+1 day'`. Worst-case AAI cost per active free user: $0.085/day. (§1 tier table, §10.4)
14. **Engagement tracking columns on `users`.** `total_minutes_lifetime`, `total_files_lifetime`, `active_days_count`, `last_active_at`, `hit_daily_cap_count`. Powers post-launch targeted-discount logic; `hit_daily_cap_count` is the strongest upgrade signal — a user who hits the daily wall repeatedly is literally telling you they want more. (§5)
15. **Google One-Tap added as primary auth entry.** ID token verified server-side via Google `tokeninfo`, then mints a next-auth-compatible JWT cookie. Standard OAuth redirect remains as fallback for incognito / blocked-prompt cases. Manual-setup §1.2 gains an "Authorized JavaScript origins" config step. (§7)

*Historical note: this plan preserved the original v1 scope decisions. Do not treat it as current product or architecture truth without checking code and runbooks.*
