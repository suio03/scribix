# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Scribix is

A Next.js (App Router, React 19) audio/video transcription SaaS deployed to **Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare`), not Vercel. Users upload audio/video (or record / paste a YouTube URL), it's transcribed by **AssemblyAI**, and results are stored and exported. Persistence is **Cloudflare D1** (SQLite); media lives in **Cloudflare R2**; billing is **Creem**; auth is **next-auth (Google)**.

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
```

There is **no test framework or `npm test`**. Validate changes with `npm run build` plus manual checks of affected flows (upload, record, transcript status/export, billing, auth, localized pages).

## Transcription lifecycle (the core flow)

This is the central architecture and spans several files — read these together before touching the pipeline:

1. **`POST /api/transcripts/init`** — validates per-tier duration/size caps (`PLANS` in `lib/plans.ts`), creates a `pending` transcript row, and returns a presigned R2 **PUT** URL (`lib/r2.ts`). The client uploads media directly to R2 (browser → R2, not through the Worker). Video is extracted to ~64 kbps mono MP3 client-side (ffmpeg.wasm / Web Audio) before this step; `maxVideoUploadBytes` is a hard ceiling so a client can't claim `isVideo` and PUT an unbounded blob.
2. **`POST /api/transcripts/[id]/start`** — reserves quota (`reserveQuota` in `lib/quota.ts`), presigns an R2 **GET** URL, and submits to AssemblyAI (`submitTranscript` in `lib/aai.ts`) with a webhook callback. Status moves `pending → uploading → queued`. On AAI submit failure it **refunds the reservation** (`reconcileQuota`) and marks the row `error` — quota must never strand.
3. **`POST /api/webhook/assemblyai`** — AAI calls back on completion; verified via the `X-Scribix-Token` header matching the row's `webhook_token`. Fetches the result, writes transcript JSON to R2, reconciles quota against actual `audio_duration`, sets `completed`.
4. **Status statuses** progress through `pending → uploading → queued → processing → extracting_audio → uploading_audio → transcribing → completed | error | failed` (see `migrations/0002`).

Quota model (`lib/quota.ts` + `lib/plans.ts`): a **single `minutes_used_this_period` counter** on `users`, no credit ledger. Free tier is a one-time lifetime trial (never resets); paid tiers reset on Creem cycle webhook events. Reservations are atomic and reconciled against actual duration after completion.

## Billing (Creem)

`POST /api/webhook/creem` verifies the HMAC signature **before any side effect**, runs side effects, then writes a dedup row only on success (so a transient failure still retries). Handlers are idempotent (absolute UPDATEs). Cycle events reset the quota counter; mid-cycle plan changes keep the counter; downgrades are blocked. Plan↔Creem-product mapping lives in `lib/creem-plans.ts`; tier caps/pricing in `lib/plans.ts`.

## Auth

`auth.ts` (next-auth v5 beta, **JWT sessions**) supports Google OAuth and Google One-Tap (credentials provider verifying an id_token via Google's tokeninfo). User rows are upserted into D1 on sign-in keyed by Google `profile.sub`. Use `getOrCreateCurrentUser(env.DB, session)` (`lib/current-user.ts`) in route handlers to resolve the DB user — never trust the session alone for ownership/tier checks.

## i18n

next-intl with locales `["en", "fr", "es", "it", "ja", "de"]`, `defaultLocale: "en"`, `localePrefix: "as-needed"`. Localized pages live under `app/[locale]/...`; config in `i18n/` (`routing.ts`, `request.ts`, `navigation.ts`); strings in `messages/*.json`. `middleware.ts` runs the intl middleware and additionally rewrites/redirects legal pages (`privacy`, `refunds`, `terms`) to canonical English-only URLs.

**Locale-file rule:** changing an existing string → edit `en.json` only. Adding a new key → mirror the English value into all 6 locale files, or next-intl throws a missing-message error at runtime.

## Cleanup Worker

`crons/cleanup-worker.ts` is a **separate** scheduled Worker (deployed via `wrangler.cleanup.jsonc`, sharing the same D1 + R2 bindings). Hourly it hard-deletes stale `pending`/`uploading` rows (>1h), stalled in-flight rows (>24h), `error`/`failed` rows (>7d), and deletes R2 audio for `completed` rows >14d while preserving transcript JSON forever.

## Conventions

- TypeScript `strict`; import from root via the `@/*` alias. Two-space indent, double-quoted strings, named exports, PascalCase component files.
- Route handlers export HTTP-method functions from `route.ts`. Add `"use client"` only where browser APIs/hooks require it.
- Cloudflare bindings: `DB` (D1), `SCRIBIX_MEDIA` (R2), `ASSETS`. Reach them via `await cf()`. After changing `wrangler.jsonc` bindings, run `npm run cf-typegen`.
- R2 object key layout is `users/{userId}/{transcriptId}`. R2 presigning uses `aws4fetch` against the S3-compatible endpoint (the Workers R2 binding can't presign) — requires `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- Treat `wrangler.jsonc`, `wrangler.cleanup.jsonc`, `migrations/`, and `cloudflare-env.d.ts` as deployment-sensitive. Document required remote migrations in PRs. Never commit secrets (`worker-secrets.env`, `.dev.vars`).
- Commits: short imperative, Conventional Commit prefixes (`feat:`, `fix:`). `CHANGELOG.md` is maintained per release.

## Reference

`docs/progress.md` is the original product/architecture spec (the "source of truth" referenced in migration comments). `docs/runbooks/` holds ops procedures (launch checklist, AAI bulk delete). `docs/landing-page-*.md` document SEO landing-page intent — the homepage targets "video to text"; each tool gets its own landing page.
