# Post-release reliability and conversion monitoring

Use this runbook for the first seven complete days after the repaired upload pipeline is deployed. The current code identifies this release as `upload_pipeline_version=2026-07-25.1`.

Release `0.18.1` (commit `30f4b0a`) remains the original repaired-upload baseline. Release `0.20.0` (commit `4b79377`) simplified new purchases to Pro with 2,400 minutes reset monthly, and `0.20.1` (commit `36f6c86`) centralized localized application structure. Release `0.21.0` (commit `1eba679`) changes the upload pipeline version and adds explicit Free partial transcription, unknown-duration audio fallback, durable partial-result labels, quota-settlement guards, and recording-duration fixes. Release `0.22.0` (commit `2df9770`) adds multi-browser extension packaging and token authentication without changing the upload pipeline version. Production migrations `0016` through `0019` were applied on 2026-07-22; additive migrations `0020_partial_transcripts.sql` and `0021_extension_auth_tokens.sql` were applied remotely on 2026-07-25. Confirm the Cloudflare deployment is healthy before treating the next complete Melbourne calendar day as day 1.

## Prerequisites

- Deploy the application and confirm migrations `0016` through `0021` are applied to the production D1 database.
- Create the configured Scribix custom events in Plausible. `checkout_completed` is a conversion event; revenue stays in Paddle.
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

Also review `transcribe_fail` by `error_type`, `error_code`, `step`, `tool_slug`, `upload_mode`, `fallback_reason`, `retryable`, and `upload_pipeline_version`. Keep business-limit rejections separate from technical failures. Build the Free partial funnel from `partial_transcript_offer_shown`, `partial_transcript_confirmed`, `partial_transcription_started`, and `partial_transcript_upgrade_clicked`; segment unknown duration with `duration_unknown`, and inspect `upload_size_cap_rejected` separately from quota decisions.

For the AI Note Taker landing page, segment `tool_visit`, transcription events, and YouTube inspect/import events by `tool_slug=ai-note-taker`. Treat missing `tool_slug` as an instrumentation defect rather than zero conversion.

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

- Signed out: homepage, audio-to-text, MP3, and AI Note Taker entry points return to the same localized tool page after OAuth.
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
- Checkout: new purchase UI offers Pro only, defaults to $120 yearly, allows $20 monthly, and sends the matching live price ID. Verify completed, closed, and failed paths; the completed transaction appears once in the ownership records and no amount is sent to Plausible.
- SEO: `/sitemap.xml`, `/robots.txt`, canonical/hreflang, `/ai-note-taker`, English plus at least one localized page; legal sitemap entries have no localized alternates.

For large-file and paid-plan tests, use dedicated test accounts and non-sensitive media. Avoid real customer files.
