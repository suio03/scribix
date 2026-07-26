# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Scribix is

A Next.js (App Router, React 19) audio/video transcription SaaS deployed to **Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare`), not Vercel. Users upload or record audio/video for **AssemblyAI** transcription, or import available YouTube caption tracks through the dedicated caption service. Paid users can turn completed transcripts into AI Notes with an overview, key points, and action items. Results are stored and exported. Persistence is **Cloudflare D1** (SQLite); media lives in **Cloudflare R2**; billing runs through **Paddle Billing**; auth is **next-auth (Google)**.

Because it targets the Workers runtime, all server code must be edge-compatible: use `fetch` (no Node networking), and reach Cloudflare bindings through `await cf()` (`lib/cf.ts`), never assume Node globals.

## Commands

```bash
npm run dev                 # Next dev server (webpack). User runs this themselves — don't auto-start it.
npm run build               # Production Next build — the primary validation gate (there is no test runner).
npm run preview             # OpenNext build + Cloudflare preview with REMOTE bindings
npm run deploy              # OpenNext build + deploy to Cloudflare
npm run cf-typegen          # Regenerate cloudflare-env.d.ts after changing wrangler bindings
npm run db:migrate:local    # Apply D1 migrations locally
npm run db:migrate:remote   # Apply D1 migrations to remote D1
npm run deploy:cleanup      # Deploy the separate cleanup Worker (wrangler.cleanup.jsonc)
npm run extension:all:zip   # Build production Chrome, Edge, and Firefox extension ZIPs
npm run extension:firefox:source # Build the Firefox reviewer source ZIP
```

There is **no test framework or `npm test`**. Validate changes with `npm run build` plus manual checks of affected flows (upload, record, transcript status/export, billing, auth, localized pages).

## Transcription lifecycle (the core flow)

This is the central architecture and spans several files — read these together before touching the pipeline:

1. **`POST /api/transcripts/preflight`** — performs authenticated, read-only format, size, duration, and quota checks before extraction or upload. For Free file uploads that exceed the remaining lifetime allowance, or whose duration is unavailable in the browser, it returns the real processable minutes and requires explicit partial-transcript confirmation.
2. **`POST /api/transcripts/init`** — revalidates limits and creates a `pending` row. Browser-unsupported audio and video containers may continue with unknown duration, but recordings must supply the authoritative Recorder duration. Audio and successfully extracted small-video audio receive a presigned single PUT URL. Videos over 1 GiB, metadata failures, and extraction failures create an R2 multipart upload instead. Direct video uses fixed 100 MiB parts with two browser workers and server-side ListParts/ETag validation; never buffer the whole file in JavaScript. Free video is capped at 2 GiB, paid video at 4.9 billion bytes (displayed as 5 GB), and audio at 1 GiB.
3. **`POST /api/transcripts/[id]/start`** — HEAD-validates the completed R2 object, atomically reserves quota, and submits to AssemblyAI with `audio_end_at`. Free upload truncation requires `allowPartial: true`; `confirmedPartialMin` prevents processing more than the user confirmed if quota changes concurrently. Old clients without consent are rejected. Status moves `pending → uploading → queued`. Definite AAI submit failures refund immediately; ambiguous network/response failures stay `uploading` and continue status recovery without a blind resubmit.
4. **`POST /api/webhook/assemblyai`** — verifies `X-Scribix-Token`, recovers ambiguous submits by unique token, writes transcript JSON to R2, and reconciles quota. `resolveAaiDuration` supports both observed capped-duration and documented full-source `audio_duration` semantics: processed duration is always clamped to `processing_limit_sec`, and source duration is backfilled only when it can be inferred safely.
5. **Statuses** progress through `pending → uploading → queued → processing → extracting_audio → uploading_audio → transcribing → completed | error | failed` (see `migrations/0002`).

Quota model (`lib/quota.ts` + `lib/plans.ts`): a **single `minutes_used_this_period` counter** on `users`, no credit ledger. Free transcription minutes are a 45-minute lifetime trial and never reset. Free file uploads may be up to 10 hours, but only the explicitly confirmed remaining minutes are processed; this strict consent policy applies to `source="upload"` only. Pro and recording paths retain the legacy half-estimate threshold until their UX is redesigned. Pro monthly and yearly subscriptions both receive 2,400 minutes per month; yearly Pro is billed annually, but `lib/quota-period.ts` derives monthly allowance windows from the Paddle annual period and lazily resets usage with no rollover. Reservations are atomic and settlement never exceeds `reserved_minutes`; work started in an older allowance window cannot change the current window's usage.

Partial-transcript state is persisted by migration `0020`: `source_duration_sec` is the known full source length, `processing_limit_sec` is the server boundary, and `partial_requested` records explicit Free consent. Derive display scope with `lib/partial-transcript.ts`; do not store a second transcript-scope flag. TXT and DOCX include the partial notice, VTT uses a standards-compliant `NOTE` block, and SRT/CSV file bodies remain unchanged for compatibility.

## Billing

Paddle is wired through `app/api/paddle/create-checkout/route.ts`, `app/api/paddle/create-portal/route.ts`, and `app/api/webhook/paddle/route.ts`. New purchases offer Pro only: $20 monthly or $120 yearly. Price IDs are resolved in `lib/paddle-plans.ts`; public caps and display prices remain in `lib/plans.ts`. The Basic/Starter price IDs and backend tier remain configured only for grandfathered subscribers, so do not remove them or expose Starter in new checkout UI. Paddle is the only source of truth for monetary amounts. Scribix stores transaction and adjustment ownership metadata for entitlement, idempotency, and routing, but does not copy revenue, tax, or refund amounts. The webhook verifies Paddle signatures, dedupes events in `paddle_events`, stores Paddle customer/subscription IDs on `users`, resets minute and YouTube-import counters when a billing period advances, and expires users back to free when paid access ends.

Discord notifications have strict channel ownership: transcription/webhook failures use `DISCORD_ERROR_WEBHOOK_URL`, billing events use `DISCORD_CHECKOUT_WEBHOOK_URL`, and submitted feedback uses `DISCORD_FEEDBACK_WEBHOOK_URL`. Successful transcription and maintenance events, plus account deletion, stay in structured logs rather than Discord.

## AI Notes

**AI Notes** is the user-facing name for the existing summary pipeline; internal routes, storage fields, and types may still use `summary`. Pro and grandfathered Starter users generate notes from a completed transcript through `GET/POST /api/transcripts/[id]/summary`; both methods reject Free users. Translation read and generation routes enforce the same paid-only boundary. `lib/openai-summary.ts` asks OpenAI for an overview, key points, and concrete action items, then the route stores the payload in R2 and status metadata in D1. `OPENAI_API_KEY` is required.

`/[locale]/ai-note-taker` is the localized acquisition page. It reuses the shared upload, recording, YouTube, and marketing components. When changing these entry points, preserve `tier`, `billingCycle`, and `toolSlug` through every path so limits and analytics attribution stay correct.

## YouTube captions and extension

The in-app YouTube workflow uses `app/components/YouTubeImporter.tsx` plus `app/api/transcripts/youtube/*` routes to inspect available caption tracks, reserve YouTube import quota, import the selected captions, and save a completed transcript row. It does not download YouTube video/audio. Free users get 10 YouTube caption imports per UTC day and a 2-hour YouTube video cap; paid caps come from `lib/plans.ts`.

The Chrome, Edge, and Firefox extension source lives in `chrome-extension-youtube-transcript/`; `scripts/build-extension.mjs` creates browser-specific manifests and packages. New clients authenticate through `app/api/extension/auth/*` using the browser identity API, PKCE, and the 15-minute access/30-day rotating refresh sessions in `lib/extension-auth.ts` and migration `0021`. The published Chrome 0.1.2 origin temporarily retains website-cookie fallback in account and summary routes; all newer clients send bearer tokens and can revoke their refresh session when signing out. Production Edge authorization requires `EDGE_EXTENSION_ID` in `wrangler.jsonc` to match the Partner Center CRX ID; changing it requires redeployment. The extension also calls `GET /api/extension/account`, `POST /api/extension/youtube/transcript`, and `POST /api/extension/youtube/summary`. Its manifest matches YouTube broadly for SPA navigation, but `content.js` only mounts the panel on desktop `/watch` pages with a video ID. Extension transcript quota is enforced separately in `lib/youtube-extension-quota.ts`. Store packaging, disclosures, and reviewer instructions live in `docs/browser-extension-publishing.md`.

## Auth

`auth.ts` (next-auth v5 beta, **JWT sessions**) supports Google OAuth and Google One-Tap (credentials provider verifying an id_token via Google's tokeninfo). User rows are upserted into D1 on sign-in keyed by Google `profile.sub`. Use `getOrCreateCurrentUser(env.DB, session)` (`lib/current-user.ts`) in route handlers to resolve the DB user — never trust the session alone for ownership/tier checks.

## i18n

next-intl with locales `["en", "fr", "es", "it", "ja", "de"]`, `defaultLocale: "en"`, `localePrefix: "as-needed"`. Localized pages live under `app/[locale]/...`; config in `i18n/` (`routing.ts`, `request.ts`, `navigation.ts`); strings in `messages/*.json`. `middleware.ts` runs the intl middleware and additionally rewrites/redirects legal pages (`privacy`, `refunds`, `terms`) to canonical English-only URLs.

**Locale-file rule:** adding a new key requires the same key in all 6 locale files, or next-intl throws a missing-message error at runtime. Keep routes, icons, IDs, ordering, layout classes, prices, quotas, and limits in typed TypeScript rather than `messages/*.json`; translations contain user-facing copy and localized templates only. Run `npm run check-locales` after message changes (it also runs automatically before build, preview, and production deploy). When a string changes a product fact or behavior (limits, retention, errors), interpolate it from canonical configuration such as `lib/plans.ts`; a purely editorial English rewrite may stay in `en.json`.

## Cleanup Worker

`crons/cleanup-worker.ts` is a **separate** scheduled Worker (deployed via `wrangler.cleanup.jsonc`, sharing the same D1 + R2 bindings). Hourly it hard-deletes stale `pending`/`uploading` and in-flight rows (>24h), refunding any outstanding reservation atomically before deletion; deletes `error`/`failed` rows (>7d); and deletes completed audio/video media >14d while preserving transcript JSON. Every path deletes referenced R2 objects before clearing keys or deleting D1 rows; failures retain the reference for the next hourly retry. The bucket lifecycle only aborts incomplete multipart uploads after 7 days and must not expire the shared `users/` prefix.

## Conventions

- TypeScript `strict`; import from root via the `@/*` alias. Two-space indent, double-quoted strings, named exports, PascalCase component files.
- Route handlers export HTTP-method functions from `route.ts`. Add `"use client"` only where browser APIs/hooks require it.
- Cloudflare bindings: `DB` (D1), `SCRIBIX_MEDIA` (R2), `ASSETS`. Reach them via `await cf()`. After changing `wrangler.jsonc` bindings, run `npm run cf-typegen`.
- R2 object key layout is `users/{userId}/{transcriptId}`. R2 presigning uses `aws4fetch` against the S3-compatible endpoint (the Workers R2 binding can't presign) — requires `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- `NEXT_PUBLIC_DIRECT_VIDEO_UPLOAD_ENABLED` is a build-time kill switch, not a runtime rollout control. It defaults to enabled; setting it to `false` only takes effect after rebuilding and redeploying.
- Treat `wrangler.jsonc`, `wrangler.cleanup.jsonc`, `migrations/`, and `cloudflare-env.d.ts` as deployment-sensitive. Document required remote migrations in PRs. Never commit secrets (`worker-secrets.env`, `.dev.vars`).
- Commits: short imperative, Conventional Commit prefixes (`feat:`, `fix:`). `CHANGELOG.md` is maintained per release.

## Reference

`docs/progress.md` is a historical v1 planning artifact, not the current source of truth. Current operational setup lives in `docs/manual-setup.md`; `docs/runbooks/` holds ops procedures, including the active `post-release-monitoring.md` checklist for upload reliability and conversion. `docs/plan-hybrid-video-upload.md` records the shipped hybrid-upload architecture, while `docs/plan-post-july-19-reliability-growth.md` is the dated analysis and decision record for the `0.18.x` reliability work rather than an evergreen backlog.
