# Post-release reliability and conversion monitoring

Use this runbook for the first seven complete days after the repaired upload pipeline is deployed. The code identifies this release as `upload_pipeline_version=2026-07-22.1`.

## Prerequisites

- Deploy the application and apply migrations `0016` through `0019` to the production D1 database.
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
| Checkout opened → completed | Directional until volume grows | A client completion without a ledger match |
| Direct upload P50/P90 | Establish baseline | P90 grows by >50% for two days |

Also review `transcribe_fail` by `error_type`, `error_code`, `step`, `tool_slug`, `upload_mode`, `fallback_reason`, `retryable`, and `upload_pipeline_version`. Keep business-limit rejections separate from technical failures.

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

- Signed out: homepage, audio-to-text, and MP3 CTA return to the same localized tool page after OAuth.
- Signed in: small audio, small video, and a direct-upload video complete without duplicate transcripts.
- Free, Starter, and Pro: valid file, duration limit, quota limit, audio-size limit, and video-size limit.
- Network recovery: interrupt a multipart part and polling, restore the network, and confirm processing resumes without a new transcript.
- Submit recovery: explicit retryable AAI failure retries safely; ambiguous timeout continues polling without creating a second job, and stale cleanup returns reserved quota.
- Record: start, pause, resume, preview, discard, upload, permission denial, and unsupported-browser messaging.
- YouTube: URL survives OAuth, inspect resumes, import does not run automatically.
- Checkout: completed, closed, and failed paths; completed transaction appears once in the ownership records and no amount is sent to Plausible.
- SEO: `/sitemap.xml`, `/robots.txt`, canonical/hreflang, English plus at least one localized page; legal sitemap entries have no localized alternates.

For large-file and paid-plan tests, use dedicated test accounts and non-sensitive media. Avoid real customer files.
