# Runbook — launch checklist

One-shot list to walk before flipping `scribix.io` live. Most of the heavy
lifting (CF account, secrets, custom domain) lives in `docs/manual-setup.md`
Phase 7 — this file is the "everything else" pre-flight.

## Prereqs (from manual-setup.md)

- [ ] Phase 0–6 complete locally and on `--remote` D1.
- [ ] `npm run deploy` succeeds at least once to a `*.workers.dev` URL.
- [ ] Custom domain `scribix.io` attached in Cloudflare Workers.
- [ ] Worker secrets set via `wrangler secret put` (see manual-setup §7.3).
- [ ] `wrangler.jsonc` `vars` block has prod URLs.
- [ ] `db:migrate:remote` applied.

## Webhook URLs

- [ ] **AssemblyAI** — no dashboard step. Webhook URL is per-job, set inline
  on each `POST /v2/transcript`. Confirmed working when a real upload completes
  end-to-end on prod and the row flips to `completed`.
- [ ] **Paddle** — notification destination points to
  `https://scribix.io/api/webhook/paddle` and subscribes to transaction and
  subscription lifecycle events.

## R2

- [ ] CORS allows `PUT` from `https://scribix.io` (manual-setup §0.4).
- [ ] Lifecycle rule on `audio/` prefix expires objects after **7 days**
  (manual-setup §0.5). This is the sole authority for audio expiry.

## Smoke tests on prod

- [ ] Sign in with Google → user row appears in D1.
- [ ] Paid checkout from `/pricing` opens Paddle overlay for Starter monthly.
- [ ] Completed Paddle checkout returns to `/dashboard?checkout=ok`, webhook
  activates the tier, and duplicate webhook delivery is ignored.
- [ ] `/dashboard/account` opens Paddle Customer Portal for a `ctm_*` customer.
- [ ] Paddle cancellation marks the subscription canceled without removing
  access before the period end.
- [ ] Upload a 30 s audio file → row reaches `completed` → transcript renders.
- [ ] Hit `/refunds`, `/terms`, `/privacy` — all 200 OK.
- [ ] Hit `https://scribix.io/sitemap.xml` and `/robots.txt` — both serve.
- [ ] Soft-delete a transcript → audio + JSON disappear from R2; row hidden.
- [ ] Soft-delete an account from `/dashboard/account` → user signed out;
  D1 row marked `deleted_at`.

## §16 open items (resolve before announcing)

- [ ] **Refund policy** — written at `/refunds` with Paddle-aligned 14-day
  refund request wording and no usage-based qualifiers.
- [ ] **Free-tier recording max length** — confirm 30 min cap matches the
  Free quota in `Recorder.tsx` and `lib/plans.ts`.
- [ ] **AAI bulk-delete cadence** — schedule the first run on the 1st Monday
  of the next month and add a calendar reminder
  (see `docs/runbooks/aai-bulk-delete.md`).
- [ ] **Discord webhook** — confirmed posting from prod (try a test transcript
  failure or watch the first paid checkout).

## Marketing

- [ ] Submit `https://scribix.io/sitemap.xml` to Google Search Console.
- [ ] Verify domain in Google Search Console + Bing Webmaster.
- [ ] OG card preview looks right (`https://scribix.io` → opengraph-image
  served from `app/[locale]/opengraph-image.tsx`).
- [ ] Pricing page yearly bullets read "available immediately, refreshed at
  renewal" (§1 marketing copy note).
- [ ] Paddle Customer Portal plan switching is restricted so unsupported
  self-service downgrades are not exposed.

## Day-1 monitoring

- [ ] Watch the Discord ops channel for the first hour after announcing.
- [ ] First failed transcription should fire a `transcription_failed` alert.
