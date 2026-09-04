# Post-release reliability and conversion monitoring

Use this runbook for the first seven complete days after the repaired upload pipeline is deployed. The current code identifies this release as `upload_pipeline_version=2026-07-25.1`.

Release `0.25.1` (commit `776de74`) is the current transcript Ask AI baseline, including tiered question allowances, AI token/cost accounting, and anonymous product-funnel events without changing the upload pipeline version. Production D1 is migrated through `0024_ai_usage_events.sql` as of 2026-08-01. Confirm the Cloudflare deployment is healthy before treating the next complete Melbourne calendar day as day 1.

## Prerequisites

- Deploy the application and confirm migrations `0016` through `0024` are applied to the production D1 database.
- Create the configured Scribix custom events in Plausible. `checkout_completed` is a conversion event; revenue stays in Paddle.
- Include `ask_ai_question_submitted`, `ask_ai_answer_succeeded`,
  `ask_ai_answer_failed`, `ask_ai_quota_reached`, `ask_ai_upgrade_clicked`, and
  `ask_ai_chat_cleared`; Ask AI deliberately has no opened event.
- Keep `/Users/laughingli/Documents/side-projects/tracking/projects.json` aligned with `lib/analytics.ts`.
- Add `BING_WEBMASTER_API_KEY` to `tracking/.env.local` after Scribix is verified in Bing Webmaster Tools.

If a prerequisite is missing, report the metric as unavailable. Do not interpret it as zero.

## Daily data pull

Use Melbourne calendar dates and wait for the prior day to be complete before evaluating it.

```bash
cd /Users/laughingli/Documents/side-projects/tracking
node fetch-plausible.js scribix YYYY-MM-DD YYYY-MM-DD
node fetch-gsc.js scribix YYYY-MM-DD YYYY-MM-DD
node fetch-bing.js scribix
node post-release-report.js data/plausible/scribix/YYYY-MM-DD_YYYY-MM-DD.json
```

The Bing legacy API selects its own reporting window. Always inspect `meta` and returned dates before comparing it with Plausible or GSC. It provides query and page statistics but does not expose the same country/device breakdown used by Plausible; use Plausible for device and country behavior.

## Daily checks

Record these results once per day:

| Metric | Seven-day target | Investigate when |
| --- | ---: | --- |
| Overall transcription success | ≥65% | Two days below 65% |
| Desktop transcription success | ≥60% | Any day below 55% |
| Homepage transcription success | ≥50% | Any day below 40% |
| Technical failures / all transcript events | <5% | Any day ≥7% |
| Eligible direct upload completion | ≥70% | Any day below 60% with at least 10 selections |
| Terminal `transcript_poll_failed` | 0 | Any occurrence |
| Duration/quota upgrade CTA click rate | ≥8% | Seven-day rate below 8% with at least 25 impressions |
| Partial offer → confirm or upgrade | Establish baseline, including normal abandon rate | Residual abandon rate spikes, or events lose `processing_minutes` |
| Partial confirm → transcription started | ≥95% | Any sustained gap after excluding submit-uncertain recovery |
| Checkout opened → completed | Directional until volume grows | A client completion without a ledger match |
| Direct upload P50/P90 | Establish baseline | P90 grows by >50% for two days |
| Ask AI submitted → success | Establish baseline | Outcomes no longer reconcile with submitted questions |
| Ask AI quota → upgrade click | Establish baseline | Event properties contain content or identifiers |

Also review `transcribe_fail` by `error_type`, `error_code`, `step`, `tool_slug`, `upload_mode`, `fallback_reason`, `retryable`, and `upload_pipeline_version`. Keep business-limit rejections separate from technical failures. Build the Free partial funnel from `partial_transcript_offer_shown`, `partial_transcript_confirmed`, `partial_transcription_started`, and `partial_transcript_upgrade_clicked`; segment unknown duration with `duration_unknown`, and inspect `upload_size_cap_rejected` separately from quota decisions.

For the AI Note Taker landing page, segment `tool_visit`, transcription events, and YouTube inspect/import events by `tool_slug=ai-note-taker`. Treat missing `tool_slug` as an instrumentation defect rather than zero conversion.

## Ask AI cost check

Use the retained usage ledger for cost and cache analysis; it intentionally does
not contain question, answer, or transcript text:

```bash
npx wrangler d1 execute scribix-db --remote --command "SELECT date(created_at) AS day, plan_tier, model, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens, SUM(cached_input_tokens) AS cached_input_tokens, ROUND(100.0 * SUM(cached_input_tokens) / NULLIF(SUM(input_tokens), 0), 2) AS cached_input_pct, SUM(output_tokens) AS output_tokens, ROUND(SUM(estimated_total_cost_microusd) / 1000000.0, 6) AS estimated_usd FROM ai_usage_events WHERE feature = 'transcript_chat' GROUP BY day, plan_tier, model ORDER BY day DESC, plan_tier, model"
```

Treat `cached_input_tokens = 0` as a cache miss, not an instrumentation failure.
Compare cost per successful question and per plan before changing allowances or
pricing; keep failed rows visible because provider failures can still report
billable token usage.

In Plausible, segment Ask AI by `plan_tier`, `question_source`, and
`transcript_source`; use truncation flags and stable `error_code` for reliability.
Do not add user/transcript IDs, titles, language text, questions, answers, or
token counts to client analytics.

## Payment ownership checks

Use Paddle for revenue, tax, refund, and chargeback reporting. In Scribix, verify that completed checkout transaction IDs appear once in `paddle_transactions` and related adjustment IDs appear in `paddle_adjustments`. Plausible checkout events are attribution data only; never infer revenue from them.

## Seven-day decision

At the end of seven complete deployed days:

1. Run one Plausible pull for the complete seven-day range and generate the post-release report.
2. Compare the same weekdays with the previous complete seven-day period.
3. Segment results by desktop/mobile, homepage/dashboard, extracted-audio/direct-video, and pipeline version.
4. Keep the release if reliability targets are met or materially improving without billing discrepancies.
5. Open a focused follow-up issue for any failed target; do not combine unrelated reliability, conversion, and SEO changes.

Do not judge the `/audio-to-text` metadata experiment until at least four weeks or 200 search impressions have accumulated.

## Manual release smoke test

Before deployment, and again against production after deployment, verify:

- Signed out: homepage, video-to-text, audio-to-text, MP3, and AI Note Taker
  entry points return to the same localized tool page after OAuth.
- Signed in: small audio, small video, and a direct-upload video complete without duplicate transcripts.
- Free known-duration file over remaining quota: modal shows total and real remaining minutes before upload; cancel uploads nothing; confirm processes no more than the displayed N; upgrade opens Paddle before upload and requires reselecting the file afterward.
- Free unknown-duration audio and video: modal shows full length unavailable, both actions work, and an actually short file is not mislabeled partial after completion.
- Partial result: title, player, and export panel show the scope; TXT/DOCX/VTT carry the notice while SRT/CSV file bodies remain unchanged.
- Concurrent Free starts: final processing limit never exceeds the confirmed minutes; a lower final limit is disclosed during processing.
- Grandfathered Starter and Pro: existing valid-file, duration, quota, audio-size, and video-size behavior remains unchanged.
- Network recovery: interrupt a multipart part and polling, restore the network, and confirm processing resumes without a new transcript.
- Submit recovery: explicit retryable AAI failure retries safely; ambiguous timeout continues polling without creating a second job, and stale cleanup returns reserved quota.
- Record: start, pause, stop-while-paused, resume, preview, discard, upload, permission denial, and unsupported-browser messaging; paused wall-clock time must not increase the uploaded duration.
- YouTube: URL survives OAuth, inspect resumes, import does not run automatically, plan limits are correct, and events retain the originating `tool_slug`.
- AI Notes and translation: Free read and generation requests return the upgrade boundary; Pro and grandfathered Starter retain access.
- Ask AI: a starter and follow-up answer from the current transcript, persisted
  history survives refresh, clearing removes messages without refunding quota,
  Free/grandfathered Starter (`basic`) and Pro boundaries behave as configured,
  and `ai_usage_events` records input/cached/output tokens plus estimated cost
  without prompt content.
- Checkout: new purchase UI offers Creator only (backend tier `pro`), defaults to $120 yearly, allows $20 monthly, and sends the matching live price ID. Verify completed, closed, and failed paths; the completed transaction appears once in the ownership records and no amount is sent to Plausible.
- SEO: `/sitemap.xml`, `/robots.txt`, canonical/hreflang, `/`,
  `/video-to-text`, `/ai-note-taker`, English plus at least one localized page;
  the homepage and video-to-text page keep distinct intent and canonical URLs,
  and legal sitemap entries have no localized alternates.

For large-file and paid-plan tests, use dedicated test accounts and non-sensitive media. Avoid real customer files.
