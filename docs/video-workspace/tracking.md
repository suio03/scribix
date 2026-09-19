# Video tracking events

This change adds browser events to the existing Plausible-compatible collector, GA4 and Clarity. It does not add a database table, migration, event-read endpoint or replay mechanism. Existing internal `video_workspace_events` writes and business-state records remain unchanged.

## Events

| Events | Trigger |
| --- | --- |
| `video_home_cta_click` | Homepage header, hero, dropzone or final CTA activation |
| `video_upload_started`, `video_upload_completed`, `video_upload_failed` | Direct upload attempt and observed result |
| `video_project_created` | Upload-init returns a project, or create-project response confirms a new project |
| `video_candidates_started`, `video_candidates_completed` | Generate request starts and succeeds; successful empty results also count |
| `video_manual_clip_ready` | Manual clip response succeeds, including the short-source direct-edit path |
| `video_candidate_selected` | Explicit candidate-card selection |
| `video_editor_opened`, `video_edit_saved` | Editor mount and accepted save response |
| `video_render_requested` | Newly watched active export or user retry |
| `video_render_completed`, `video_render_failed` | Existing status polling observes an active job become completed or failed |
| `video_render_downloaded` | Download initiated, including automatic download; not proof that the file finished downloading |
| `video_project_failed`, `video_candidate_request_failed`, `video_manual_request_failed`, `video_editor_load_failed`, `video_editor_save_failed`, `video_export_request_failed` | Browser request errors, distinct from confirmed render-job failure |
| `video_external_edit_required` | Existing bounded feedback event contract; no new UI |

Multiple deliberate actions count separately. Repeated polls do not repeat a terminal render event. Historical completed/failed jobs are not replayed on page entry. Closing the page can prevent browser completion tracking; use existing render-job data to investigate background results. A failed browser request does not prove the backend action failed.

## Exported properties

Only event names, plan tier, file size in MB, duration in seconds, elapsed milliseconds and allowlisted error codes are sent. Available properties vary by event. `analytics-contract.ts` strips unknown fields, free text, IDs, filenames, content and media URLs. Edit elapsed time means time since editor mount; render elapsed time means job creation to completion, including retries.

The deployed legacy Plausible script always attaches the full current URL and does not support an override. New video events use its existing `https://actone.app/api/event` endpoint directly, with a fixed `https://scribix.io/video-workspace` URL, null payload referrer and no HTTP referrer. GA4 video events use fixed page location/title/referrer too. Existing pageviews, Clarity session recording and payment tracking are unchanged.

## Verification and release

- Run `npm run test:video-tracking`, `npm run test:video-workspace` and `npm run build`.
- Deploy the app; no database migration or Container deployment is required for this change.
- Configure matching event goals in the existing analytics dashboard where required. See [Plausible goal setup](https://plausible.io/docs/custom-event-goals). Dashboard changes are not performed by this code change.
- Run the live upload → candidates/manual clip → save → export → download flow and verify collector requests and dashboard receipt. Check safe properties, failed/retried jobs and repeated status polls.

The automated tests use mocked collectors and send no real analytics. Live receipt has not yet been verified for this change.

## Publish flow (2026-09-08)

Candidate start follows an explicit request (or persisted pending request); waiting for transcription is not candidate completion. Resuming that request does not add another start. Successful empty results still count as completion. Upload navigation may happen before transcription completes; the existing in-browser poll continues to observe completion while mounted. Closing the page can lose browser observations.

Selection requirements and generated/edited publishing text never enter event properties. Existing AI usage records capture cost; the new selection, quota and package records are operational state, not tracking tables. Video-only downloads use the existing `assetKind: video`; full downloads use `package`. Download remains an initiation signal, not publication. The tracking schema itself is unchanged; the overall feature requires the migration and Container release described in [publish preparation](publish-preparation.md).

## Tracking repairs (2026-09-19, pending deployment)

- Candidate polling discards responses started before a new request or its POST response, so a late pre-retry failure cannot settle the retried task. A rejected concurrent request releases its observer so polling can adopt the active server task.
- Candidate POST acceptance and subsequent GET polling now share a request-scoped observer. `video_candidates_failed` means an observed failed task; `video_candidate_request_failed` remains an HTTP/request failure. Completion includes successful empty results. Historical terminal states are not replayed; a restored active task can produce one observed terminal event. After refresh, elapsed time measures the current browser observation interval, not the full server execution time. Task/request IDs stay in memory and do not enter public properties.
- YouTube adds `youtube_inspect_success` and `youtube_import_success` after successful validated responses. Import success is not proof the destination transcript was displayed. Existing transcription success likewise means observed backend completion, not result visibility.
- All public custom events now reach GA4 as well as Plausible and Clarity. GA4 excludes raw `error_message`, `transaction_id` and `checkout_id` properties. No GA revenue/purchase event is synthesized; payment truth remains in Paddle and existing transaction records.
- Missing collector functions are buffered in memory for at most 30 seconds / 100 pending sink deliveries. Each ready sink drains once, independently. This is a script-readiness buffer, not durable delivery or an offline queue. Network failures, blocked scripts, page close and capacity/TTL expiry can still lose observations. Delayed legacy Plausible events that cross navigation use the existing endpoint with the original URL and no referrer.
- Login success observation runs on all localized routes, confirms `/api/auth/session`, expires pending markers after 15 minutes and ignores responses for replaced markers. One Tap, modal, extension and pricing login entries set markers. No user ID is exported or bound to public events; login is not registration.
- No new tables, migrations or business retries. Existing operational tables remain the authority for registrations, tasks, assets and payments. Public event counts remain counts, not a user/task-linked ordered funnel.

Check analysis configuration parity with:

```sh
node scripts/sync-tracking-config.mjs /path/to/tracking/projects.json
# Add missing goals, preserving historical goals, funnels and breakdowns:
node scripts/sync-tracking-config.mjs /path/to/tracking/projects.json --write
```

The local Scribix report configuration was synchronized. Dashboard goal setup and production receipt still require release verification; the script does not configure a remote dashboard. Run `test:video-tracking` (including component-handler → sender tests), `test:video-workspace` and `build`. After deployment, verify live receipt for OAuth/One Tap, YouTube, asynchronous success/failure and repeated polls, then compare seven complete days with matching source/platform/version coverage. Do not backfill previously uncollected events or treat missing collection as zero conversion.
