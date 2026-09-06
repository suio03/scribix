# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Scribix is

A Next.js (App Router, React 19) AI video clipping and transcription SaaS deployed to **Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare`), not Vercel. The primary workflow turns long-form video into AI-selected, user-refined, publish-ready vertical clips. Scribix also supports standalone **AssemblyAI** transcription from uploads and recordings, YouTube caption imports, AI Notes, and transcript-grounded Ask AI. Persistence is **Cloudflare D1** (SQLite); media lives in **Cloudflare R2**; billing runs through **Paddle Billing**; auth is **next-auth (Google)**.

Because it targets the Workers runtime, all server code must be edge-compatible: use `fetch` (no Node networking), and reach Cloudflare bindings through `await cf()` (`lib/cf.ts`), never assume Node globals.

## Commands

```bash
npm run dev                 # Next dev server (webpack). User runs this themselves — don't auto-start it.
npm run build               # Production Next build — the primary validation gate (there is no test runner).
npm run test:video-workspace # Video contracts, candidate completeness, limits, and operations tests.
npm run test:video-security # Container image/config/security assertions; optional TRIVY_IMAGE scan.
npm run preview             # OpenNext build + Cloudflare preview with REMOTE bindings
npm run deploy              # OpenNext build + deploy to Cloudflare
npm run cf-typegen          # Regenerate cloudflare-env.d.ts after changing wrangler bindings
npm run db:migrate:local    # Apply D1 migrations locally
npm run db:migrate:remote   # Apply D1 migrations to remote D1
npm run deploy:cleanup      # Deploy the separate cleanup Worker (wrangler.cleanup.jsonc)
npm run deploy:video-render # Deploy the production Queue consumer + Cloudflare Container.
npm run extension:all:zip   # Build production Chrome, Edge, and Firefox extension ZIPs
npm run extension:firefox:source # Build the Firefox reviewer source ZIP
```

There is **no test framework or `npm test`**. Validate changes with `npm run build` plus manual checks of affected flows (upload, record, transcript status/export, billing, auth, localized pages).

## Transcription lifecycle (the core flow)

This is the central architecture and spans several files — read these together before touching the pipeline:

1. **`POST /api/transcripts/preflight`** — performs authenticated, read-only format, size, duration, and quota checks before extraction or upload. For Free file uploads that exceed the remaining lifetime allowance, or whose duration is unavailable in the browser, it returns the real processable minutes and requires explicit partial-transcript confirmation.
2. **`POST /api/transcripts/init`** — revalidates limits and creates a `pending` row. Browser-unsupported audio and video containers may continue with unknown duration, but recordings must supply the authoritative Recorder duration. Audio receives a presigned single PUT URL. All accepted video uploads retain the original source through R2 multipart upload; browser-side audio extraction is no longer used. Direct video uses fixed 100 MiB parts with two browser workers and server-side ListParts/ETag validation; never buffer the whole file in JavaScript. Free video is capped at 2 GiB, paid video at 4.9 billion bytes (displayed as 5 GB), and audio at 1 GiB.
3. **`POST /api/transcripts/[id]/start`** — HEAD-validates the completed R2 object, atomically reserves quota, and submits to AssemblyAI with `audio_end_at`. Free upload truncation requires `allowPartial: true`; `confirmedPartialMin` prevents processing more than the user confirmed if quota changes concurrently. Old clients without consent are rejected. Status moves `pending → uploading → queued`. Definite AAI submit failures refund immediately; ambiguous network/response failures stay `uploading` and continue status recovery without a blind resubmit.
4. **`POST /api/webhook/assemblyai`** — verifies `X-Scribix-Token`, recovers ambiguous submits by unique token, writes transcript JSON to R2, and reconciles quota. `resolveAaiDuration` supports both observed capped-duration and documented full-source `audio_duration` semantics: processed duration is always clamped to `processing_limit_sec`, and source duration is backfilled only when it can be inferred safely.
5. **Statuses** progress through `pending → uploading → queued → processing → extracting_audio → uploading_audio → transcribing → completed | error | failed` (see `migrations/0002`).

Quota model (`lib/quota.ts` + `lib/plans.ts`): a **single `minutes_used_this_period` counter** on `users`, no credit ledger. Free transcription minutes are a 45-minute lifetime trial and never reset. Free file uploads may be up to 10 hours, but only the explicitly confirmed remaining minutes are processed; this strict consent policy applies to `source="upload"` only. Creator (backend tier `pro`) and recording paths retain the legacy half-estimate threshold until their UX is redesigned. Monthly and yearly Creator subscriptions both receive 2,400 processed source-video minutes per month; yearly Creator is billed annually, but `lib/quota-period.ts` derives monthly allowance windows from the Paddle annual period and lazily resets usage with no rollover. Reservations are atomic and settlement never exceeds `reserved_minutes`; work started in an older allowance window cannot change the current window's usage.

Partial-transcript state is persisted by migration `0020`: `source_duration_sec` is the known full source length, `processing_limit_sec` is the server boundary, and `partial_requested` records explicit Free consent. Derive display scope with `lib/partial-transcript.ts`; do not store a second transcript-scope flag. TXT and DOCX include the partial notice, VTT uses a standards-compliant `NOTE` block, and SRT/CSV file bodies remain unchanged for compatibility.

## Billing

Paddle is wired through `app/api/paddle/create-checkout/route.ts`, `app/api/paddle/create-portal/route.ts`, and `app/api/webhook/paddle/route.ts`. New purchases offer the public Creator plan (backend tier `pro`) only: $20 monthly or $120 yearly. Upgrade CTAs open the shared one-plan modal with yearly selected by default and a link to the full pricing comparison; `/dashboard/billing` is the management surface for the current plan, usage, and Paddle portal rather than a duplicate pricing page. Price IDs are resolved in `lib/paddle-plans.ts`; public caps and display prices remain in `lib/plans.ts`. The Basic/Starter price IDs and backend tier remain configured only for grandfathered subscribers, so do not remove them or expose Starter in new checkout UI. Paddle is the only source of truth for monetary amounts. Scribix stores transaction and adjustment ownership metadata for entitlement, idempotency, and routing, but does not copy revenue, tax, or refund amounts. The webhook verifies Paddle signatures, dedupes events in `paddle_events`, stores Paddle customer/subscription IDs on `users`, resets minute and YouTube-import counters when a billing period advances, and expires users back to free when paid access ends.

Discord notifications have strict channel ownership: transcription/webhook failures use `DISCORD_ERROR_WEBHOOK_URL`, billing events use `DISCORD_CHECKOUT_WEBHOOK_URL`, and submitted feedback uses `DISCORD_FEEDBACK_WEBHOOK_URL`. Successful transcription and maintenance events, plus account deletion, stay in structured logs rather than Discord.

## AI Notes

**AI Notes** is the user-facing name for the existing summary pipeline; internal routes, storage fields, and types may still use `summary`. Pro and grandfathered Starter users generate notes from a completed transcript through `GET/POST /api/transcripts/[id]/summary`; both methods reject Free users. Translation read and generation routes enforce the same paid-only boundary. `lib/openai-summary.ts` asks OpenAI for an overview, key points, and concrete action items, then the route stores the payload in R2 and status metadata in D1. `OPENAI_API_KEY` is required.

`/[locale]/ai-note-taker` is the localized acquisition page. It reuses the shared upload, recording, YouTube, and marketing components. When changing these entry points, preserve `tier`, `billingCycle`, and `toolSlug` through every path so limits and analytics attribution stay correct.

## Transcript Ask AI

`GET/POST/DELETE /api/transcripts/[id]/chat` serves one persisted conversation per completed transcript. `lib/openai-chat.ts` calls the Responses API with `gpt-5.4-nano`, `reasoning.effort: "none"`, `store: false`, a stable privacy-preserving prompt cache key, and only the current transcript plus bounded recent history as factual context. Keep the transcript before dynamic history/question content so automatic prompt caching remains possible. Treat transcript text as untrusted data, answer in the question's language, and say when the transcript does not support an answer.

Free and grandfathered Starter (`basic`) accounts receive 3 successful questions for the account lifetime; Pro receives 300 per allowance period. Quota increments are conditional and provider failures refund the increment. Chat messages persist in `ai_chat_messages`; clearing chat does not refund quota, while transcript/account deletion hard-deletes chat content. `ai_usage_events` separately retains token counts, cached input, per-token prices, and estimated cost; transcript/account deletion nulls identifying foreign keys rather than deleting accounting history. Migrations `0022` through `0024` define this schema. Anonymous `ask_ai_*` product events in `lib/analytics.ts` cover submitted questions, outcomes, quota, upgrades, and clearing with plan/question/transcript-source and truncation/error metadata only—never IDs, titles, questions, answers, or transcript content. The transcript workspace defaults to Ask AI beside the transcript, with AI Notes as the alternate panel and Export in a modal.

## AI video workspace

Video uploads retain the original source and create a dormant video project. Free always uses AI candidate generation, including for sources up to 45 seconds; Creator and grandfathered Basic may enter the editor directly for a source up to 45 seconds. Longer sources use `gpt-5.6-terra` with medium reasoning for candidate generation and an independent completeness review: return 0–3 candidates for sources up to 3 minutes or 0–5 for longer sources, never fill a quota with weak clips. AI recommendations are generated once per project; the UI does not offer unmetered regeneration and the API rejects another AI generation after candidates exist. Every AI candidate is one continuous 15–45 second source segment. Free can select, preview, and export an AI-generated candidate exactly as generated, but cannot open clip editing or brand controls. Paid tiers can adjust original-source start/end, drag the Fill preview to reframe, switch to Fit, and apply brand controls. Paid users may keep one manual candidate at a time, delete it, and create another; AI recommendations are not individually deletable. The current editor does not expose add, delete, or reorder controls inside a cut. The EDL contract still validates up to 3 segments and 60 seconds for stored compatibility. `lib/video-workspace/access.ts` is the shared policy source, and server routes enforce the boundary instead of trusting hidden UI.

Preview and final jobs use Cloudflare Queue plus one Cloudflare Container per job. The current profile is 1 vCPU / 3072 MiB / 6000 MB with `max_instances=10` in production (1 locally); capacity errors must retry through Queue/DLQ. The image contains pinned FFmpeg, MediaPipe Tasks, and the face model. Final rendering uses the saved Fill/Fit framing choice: Fill can use conservative single-speaker smart crop or the user's crop, while Fit keeps the full frame over a blurred background. The workspace shows every candidate in one top selector. Paid tiers load one editor at a time and store autosaved drafts per candidate; Free receives a generated-clip export surface instead. Each candidate exposes only its latest completed export. A newer export supersedes and removes the previous video/cover, while the latest package remains downloadable for 30 days and may be deleted earlier. The download endpoint returns a ZIP containing MP4 plus cover for paid users and MP4 only for Free. Free final-render requests are rebuilt from the selected AI candidate on the server, browser-supplied edits are ignored, manual-origin candidates and old edited-render retries are rejected, and cover URLs are not exposed. Removing or expiring the original source also removes preview proxies and archives the project: transcript text and unexpired final exports remain, but editing and re-export stop. Deleting the video project removes all project media while preserving transcript text. Local end-to-end testing has exercised remote Cloudflare Containers. This does not establish that the production app bindings and callbacks have been validated. Apply and verify production D1 migrations `0025`–`0037` before deploying the app; a Git push alone does not apply migrations or establish deployment success. Current architecture and operational steps live under `docs/video-workspace/`.

Editor time fields use original-video timecodes, and caption correction rows show each cue's original-source interval. Audio has no user controls: drafts are normalized to 0 dB gain, no loudness normalization, and no fades so final exports retain the original source sound. Uploaded logos can be selected, replaced, or removed; removal deletes both the project asset record and its R2 object.

The current product information architecture separates video projects from transcript-only work. `/dashboard` lists video projects, `/dashboard/new` starts the video-clipping upload flow, and `/dashboard/transcripts` owns transcript-only creation and history. Authenticated product routes use `WorkspaceChrome` and `WorkspaceSidebar`; public and tool pages use `LandingChrome` with `ProductTopbar`, while the signed-out AI clipper homepage has its dedicated `VideoHomeHeader`. The approved Prism Pulse visual rules and semantic color roles live in `design-exploration/design-system.md`; keep fixed inverse styling for real source/output proof and export previews.

## YouTube captions and extension

The in-app YouTube workflow uses `app/components/YouTubeImporter.tsx` plus `app/api/transcripts/youtube/*` routes to inspect available caption tracks, reserve YouTube import quota, import the selected captions, and save a completed transcript row. It does not download YouTube video/audio. Free users get 10 YouTube caption imports per UTC day and a 2-hour YouTube video cap; paid caps come from `lib/plans.ts`.

The Chrome, Edge, and Firefox extension source lives in `chrome-extension-youtube-transcript/`; `scripts/build-extension.mjs` creates browser-specific manifests and packages. New clients authenticate through `app/api/extension/auth/*` using the browser identity API, PKCE, and the 15-minute access/30-day rotating refresh sessions in `lib/extension-auth.ts` and migration `0021`. The published Chrome 0.1.2 origin temporarily retains website-cookie fallback in account and summary routes; all newer clients send bearer tokens and can revoke their refresh session when signing out. Production Edge authorization requires `EDGE_EXTENSION_ID` in `wrangler.jsonc` to match the Partner Center CRX ID; changing it requires redeployment. Public Chrome, Edge, and Firefox store metadata remains centralized in `app/components/Sidebar.tsx`, although the current `ProductTopbar` and `WorkspaceSidebar` do not surface the extension picker. Keep store URLs, visibility, icons, and ordering in typed TypeScript and keep only localized labels in `messages/*.json`. The extension also calls `GET /api/extension/account`, `POST /api/extension/youtube/transcript`, and `POST /api/extension/youtube/summary`. Its manifest matches YouTube broadly for SPA navigation, but `content.js` only mounts the panel on desktop `/watch` pages with a video ID. Extension transcript quota is enforced separately in `lib/youtube-extension-quota.ts`. Store packaging, disclosures, and reviewer instructions live in `docs/browser-extension-publishing.md`.

## Auth

`auth.ts` (next-auth v5 beta, **JWT sessions**) supports Google OAuth and Google One-Tap (credentials provider verifying an id_token via Google's tokeninfo). User rows are upserted into D1 on sign-in keyed by Google `profile.sub`. Use `getOrCreateCurrentUser(env.DB, session)` (`lib/current-user.ts`) in route handlers to resolve the DB user — never trust the session alone for ownership/tier checks.

## i18n

next-intl with locales `["en", "fr", "es", "it", "ja", "de"]`, `defaultLocale: "en"`, `localePrefix: "as-needed"`. Localized pages live under `app/[locale]/...`; config in `i18n/` (`routing.ts`, `request.ts`, `navigation.ts`); strings in `messages/*.json`. `middleware.ts` runs the intl middleware and additionally rewrites/redirects legal pages (`privacy`, `refunds`, `terms`) to canonical English-only URLs.

**Locale-file rule:** adding a new key requires the same key in all 6 locale files, or next-intl throws a missing-message error at runtime. Keep routes, icons, IDs, ordering, layout classes, prices, quotas, and limits in typed TypeScript rather than `messages/*.json`; translations contain user-facing copy and localized templates only. Run `npm run check-locales` after message changes (it also runs automatically before build, preview, and production deploy). When a string changes a product fact or behavior (limits, retention, errors), interpolate it from canonical configuration such as `lib/plans.ts`; a purely editorial English rewrite may stay in `en.json`.

## Public-page SEO

`app/sitemap.ts` emits 45 canonical URLs: seven public routes in six locales plus three English-only legal pages. Every localized entry includes the full language-alternate set. `lib/metadata-url.ts` supplies URL helpers and the shared social image; route metadata must retain self-canonical URLs, reciprocal hreflang, and page-specific Open Graph URLs. The organization logo uses `/brand/scribix.svg`; the shared social image is `/brand/social.png`. Legacy `/opengraph-image` routes redirect to that static PNG because dynamic image rendering returned 500 on the deployed OpenNext Worker. `Footer.tsx` exposes ordinary localized links to all five transcription tools.

`i18n/plan-messages.ts` resolves shared quota and video-retention facts before ICU formatting, including content read with `t.raw()` for FAQ JSON-LD. Original videos use `PLANS` retention values; final-export retention uses `FINAL_EXPORT_RETENTION_DAYS`. Keep public copy, legal pages, and structured data consistent. Before release, verify the built sitemap URLs, metadata, JSON-LD, footer links, and referenced images against rendered HTML; local verification is not evidence of production indexing.

## Cleanup Worker

`crons/cleanup-worker.ts` is a **separate** scheduled Worker (deployed via `wrangler.cleanup.jsonc`, sharing the same D1 + R2 bindings). Hourly it hard-deletes stale `pending`/`uploading` and in-flight rows (>24h), refunding any outstanding reservation atomically before deletion; deletes `error`/`failed` rows (>7d); deletes completed non-video audio after 14 days; deletes retained video sources at their plan-specific 7/30/30-day expiry while preserving transcript JSON and unexpired final exports; deletes completed final video/cover assets 30 days after export; and removes assets superseded by a newer export of the same candidate. Every path deletes referenced R2 objects before clearing keys or deleting D1 rows; failures retain the reference for the next hourly retry. The bucket lifecycle only aborts incomplete multipart uploads after 7 days and must not expire the shared `users/` prefix.

## Conventions

- TypeScript `strict`; import from root via the `@/*` alias. Two-space indent, double-quoted strings, named exports, PascalCase component files.
- Route handlers export HTTP-method functions from `route.ts`. Add `"use client"` only where browser APIs/hooks require it.
- Cloudflare bindings: `DB` (D1), `SCRIBIX_MEDIA` (R2), `ASSETS`. Reach them via `await cf()`. After changing `wrangler.jsonc` bindings, run `npm run cf-typegen`.
- R2 object key layout is `users/{userId}/{transcriptId}`. R2 presigning uses `aws4fetch` against the S3-compatible endpoint (the Workers R2 binding can't presign) — requires `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- New video uploads always retain the original source and create a dormant video workspace project. Audio uploads keep the single-upload transcription path.
- Treat `wrangler.jsonc`, `wrangler.cleanup.jsonc`, `migrations/`, and `cloudflare-env.d.ts` as deployment-sensitive. Document required remote migrations in PRs. Never commit secrets (`worker-secrets.env`, `.dev.vars`).
- Commits: short imperative, Conventional Commit prefixes (`feat:`, `fix:`). `CHANGELOG.md` is maintained per release.

## Reference

`docs/progress.md` is a historical v1 planning artifact, not the current source of truth. Current operational setup lives in `docs/manual-setup.md`; `docs/runbooks/` holds production procedures. `docs/plan-transcript-ask-ai.md` records the shipped Ask AI v1 decisions and remaining production smoke tests. `docs/plan-collections-transcript-ai.md` remains the future Collection design; its original Ask AI proposal is superseded by the smaller shipped v1 plan.
