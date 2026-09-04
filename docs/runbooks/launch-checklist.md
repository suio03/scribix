# Runbook — launch and major-release checklist

Use this before the first live launch and again for major user-facing releases.
Most infrastructure setup lives in `docs/manual-setup.md` Phase 7; skip only
the one-time items that are already verified and unchanged.

## Prereqs (from manual-setup.md)

- [ ] Phase 0–6 complete locally and on `--remote` D1.
- [ ] `npm run deploy` succeeds at least once to a `*.workers.dev` URL.
- [ ] Custom domain `scribix.io` attached in Cloudflare Workers.
- [ ] Worker secrets set via `wrangler secret put` (see manual-setup §7.3).
- [ ] `wrangler.jsonc` `vars` block has prod URLs.
- [ ] `EDGE_EXTENSION_ID` matches the current Microsoft Partner Center CRX ID.
- [ ] A real video upload creates a retained source asset and a reusable video workspace project.
- [ ] `db:migrate:remote` applied; for release `0.25.0+`, confirm migrations
  `0020_partial_transcripts.sql` through `0024_ai_usage_events.sql` are listed
  as applied.
- [ ] `npm run deploy:cleanup` deployed the hourly cleanup Worker and its cron is visible in Cloudflare.

## Webhook URLs

- [ ] **AssemblyAI** — no dashboard step. Webhook URL is per-job, set inline
  on each `POST /v2/transcript`. Confirmed working when a real upload completes
  end-to-end on prod and the row flips to `completed`.
- [ ] **Paddle** — notification destination points to
  `https://scribix.io/api/webhook/paddle` and subscribes to transaction and
  subscription lifecycle events.

## R2

- [ ] CORS allows `PUT` from `https://scribix.io` (manual-setup §0.4).
- [ ] The default lifecycle aborts incomplete multipart uploads after **7 days**.
- [ ] No completed-media expiration rule targets `users/`; the hourly cleanup
  worker is the sole authority for completed non-video audio expiry after
  **14 days** and original-video expiry after **7/30/30 days** by plan
  (manual-setup §0.5).

## Smoke tests on prod

- [ ] Sign in with Google → user row appears in D1.
- [ ] `/pricing` and the upgrade modal offer Creator only (backend tier `pro`): yearly is selected by
  default at **$120/year**, and monthly is available at **$20/month**.
- [ ] Both Creator billing options open the Paddle overlay with the matching live
  price ID.
- [ ] Completed Paddle checkout returns to `/dashboard?checkout=ok`, webhook
  activates the tier, and duplicate webhook delivery is ignored.
- [ ] `/dashboard/account` opens Paddle Customer Portal for a `ctm_*` customer.
- [ ] Paddle cancellation marks the subscription canceled without removing
  access before the period end.
- [ ] Upload a 30 s audio file → row reaches `completed` → transcript renders.
- [ ] With a Free account whose remaining allowance is shorter than a known file,
  confirm the modal shows total and real processable minutes before upload;
  cancel uploads nothing, and partial confirmation processes no more than N.
- [ ] Upload browser-unsupported-duration audio and video as Free; confirm the
  modal says the full length is unavailable and the accepted path completes.
- [ ] Confirm a partial result keeps its scope label in the title, player, and
  export panel. TXT/DOCX/VTT include the notice; SRT/CSV bodies stay unchanged.
- [ ] Open the partial upgrade path before upload, complete or close Paddle,
  and confirm the same file can be selected again without automatic upload.
- [ ] On a completed transcript, Free opens the AI Notes upgrade flow; Pro and
  grandfathered Starter generate an overview, key points, and action items.
- [ ] On a completed transcript, Ask AI opens by default beside the transcript;
  a starter sends immediately, a custom follow-up survives refresh, and clearing
  the conversation removes messages without restoring allowance.
- [ ] Free/grandfathered Starter (`basic`) Ask AI stops after 3 lifetime
  questions; Pro stops at 300 for the current allowance period and shows its
  reset date. A controlled provider failure refunds the reserved question.
- [ ] Ask a supported fact, an absent fact, and a transcript containing an
  embedded instruction. Answers stay grounded, absent facts are identified as
  missing, and transcript text cannot override the system instructions.
- [ ] Confirm a successful Ask AI request creates one `ai_usage_events` row with
  input, cached-input, output, total token, and estimated-cost fields. A zero
  cached-input value is valid because cache hits are best effort.
- [ ] Confirm Plausible receives `ask_ai_question_submitted` followed by exactly
  one answer outcome. Verify starter/typed, plan, transcript source, truncation,
  and error properties without IDs, titles, questions, answers, or transcript text.
- [ ] Confirm `ask_ai_quota_reached`, `ask_ai_upgrade_clicked`, and
  `ask_ai_chat_cleared` fire only on the corresponding transition or action;
  loading the default Ask AI panel must not emit an opened event.
- [ ] Upload a video just over 1 GiB → multipart completes → AssemblyAI accepts
  the original video → transcript renders and media playback works.
- [ ] Test Free rejection over 2 GiB and paid acceptance near the 4.9 billion-byte cap.
- [ ] Force a metadata/extraction failure → the same file automatically falls
  back to direct video without asking the user to select it again.
- [ ] As Free, upload videos on both sides of the 45-second boundary; confirm AI
  candidate selection appears, clip/brand editing controls stay unavailable,
  and the generated export matches the selected AI candidate exactly.
- [ ] As Free, confirm direct editor, manual-candidate, brand-asset, edited-render,
  and old edited-render retry requests are rejected server-side; render listings
  do not expose cover URLs.
- [ ] As Creator, confirm direct editing for a source up to 45 seconds, candidate
  editing for a longer source, brand assets, saved revisions, final video, and
  cover download all continue to work.
- [ ] Record, pause, wait, and stop without resuming; confirm paused wall-clock
  time is excluded. Repeat with pause → resume → stop.
- [ ] Retry multipart complete after it has already succeeded → the endpoint
  confirms the exact-size final object instead of failing or deleting it.
- [ ] Hit `/ai-note-taker` and at least one localized variant; confirm the
  localized navigation entry, canonical/hreflang, upload, record, and YouTube tabs.
- [ ] Hit `/` and `/video-to-text` plus at least one localized variant of each;
  confirm the homepage presents AI video clipping, the keyword page presents
  video-to-text transcription, and both have distinct self-canonical URLs and
  complete reciprocal hreflang sets.
- [ ] Open the localized sidebar YouTube Extension picker in expanded,
  collapsed, and mobile layouts; confirm Chrome, Edge, and Firefox open their
  public stores in new tabs and display their official brand-colored icons.
- [ ] Hit `/refunds`, `/terms`, `/privacy` — all 200 OK.
- [ ] Build and install the Chrome, Edge, and Firefox packages; in each browser,
  verify account status, PKCE sign-in return, sign-out/revocation, transcript
  generation, exports, quota errors, and paid AI summary.
- [ ] Hit `https://scribix.io/sitemap.xml` and `/robots.txt` — both serve.
- [ ] Soft-delete a transcript → audio + JSON and `ai_chat_messages` disappear;
  row is hidden and matching usage rows retain cost data with `transcript_id=NULL`.
- [ ] Soft-delete an account from `/dashboard/account` → user signed out;
  D1 row is marked `deleted_at`, private chat messages are deleted, and retained
  usage rows have identifying IDs cleared.

## §16 open items (resolve before announcing)

- [ ] **Refund policy** — written at `/refunds` with Paddle-aligned 14-day
  refund request wording and no usage-based qualifiers.
- [ ] **Free-tier recording max length** — confirm the 30 min recorder cap is
  still intentional alongside the separate 45 min lifetime allowance in
  `lib/plans.ts`.
- [ ] **AAI bulk-delete cadence** — schedule the first run on the 1st Monday
  of the next month and add a calendar reminder
  (see `docs/runbooks/aai-bulk-delete.md`).
- [ ] **Discord webhooks** — confirmed a test transcript failure reaches
  `error-tracking`, the first paid checkout reaches `checkout-alerts`, and user
  feedback reaches `product-feedback`.
- [ ] **Cleanup log alert** — Cloudflare observability alerts on repeated
  `cleanup_r2_delete_failed` events; structured logs exist in code, but the
  persistent production alert must be configured separately.
- [ ] **Retention policy copy** — update `/privacy` and `/terms` so audio's
  14-day expiry and plan-specific 7/30/30-day original-video retention agree
  with `lib/plans.ts` and the cleanup worker before production release.

## Marketing

- [ ] Submit `https://scribix.io/sitemap.xml` to Google Search Console.
- [ ] Confirm the sitemap contains `/video-to-text` and `/ai-note-taker` with
  all six locale alternates.
- [ ] Verify domain in Google Search Console + Bing Webmaster.
- [ ] OG card preview looks right (`https://scribix.io` → opengraph-image
  served from `app/[locale]/opengraph-image.tsx`).
- [ ] Pricing, account usage, and Terms agree that yearly Creator receives 2,400
  minutes of uploaded video processing each month, resets monthly, and does not
  roll over.
- [ ] Paddle Customer Portal plan switching is restricted so unsupported
  self-service downgrades are not exposed.

## Day-1 monitoring

- [ ] Watch the Discord error and checkout channels for the first hour after
  announcing.
- [ ] First failed transcription should fire a `transcription_failed` alert.
- [ ] Review Ask AI success/failure logs and aggregate `ai_usage_events` token,
  cache, and estimated-cost fields without inspecting user question content.
- [ ] Compare `ask_ai_question_submitted` with success/failure outcomes and
  review starter-vs-typed plus quota-to-upgrade behavior in Plausible.
