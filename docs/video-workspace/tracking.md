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
