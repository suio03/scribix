# M4 Virtual Timeline Editor

M4 turns one accepted AI candidate into a persistent, transcript-aligned draft. It does not render a new video: the browser composes the existing per-segment proxies into a continuous virtual timeline and saves source-time EDL changes.

## Time model

- `sourceStartMs` / `sourceEndMs` remain the durable edit and final-render truth.
- `proxySourceStartMs` / `proxySourceEndMs` describe which source interval a proxy contains.
- `proxyStartMs = sourceStartMs - proxySourceStartMs` seeks into a proxy.
- `timelineStartMs` / `timelineEndMs` are recomputed from ordered EDL duration, so deleted or reordered cuts never leave gaps.

`lib/video-workspace/timeline.ts` owns these mappings and word-boundary stepping. The player keeps two video elements: the active proxy plays while the next proxy is preloaded, then the slots swap at a segment boundary.

## Draft and snapshot API

`GET /api/video-projects/:id/editor?candidateId=:candidateId`

- verifies project, candidate, source and transcript ownership;
- restores the matching draft or creates a default EDL/Render Spec;
- returns only transcript words near the current cuts;
- signs ready proxy assets individually for a short lifetime.

`PUT /api/video-projects/:id/editor`

- validates EDL and Render Spec again on the server;
- limits segment IDs to the selected candidate;
- uses `expectedRevision` as an optimistic lock;
- increments `draft_revision` and sets the project to `editing`.

`POST /api/video-projects/:id/editor`

- snapshots the already-saved draft into immutable `project_versions`;
- rejects stale revisions instead of silently snapshotting another tab's changes;
- updates `active_project_version_id` for M6 final rendering.

Migration `0028_video_editor_drafts.sql` adds `draft_candidate_id` and `draft_revision`. Migration `0032_clip_candidate_origin.sql` distinguishes AI recommendations from the direct original-source editor entry. Both must be applied remotely before deploying the current editor.

## Editing behavior

- Only one candidate is selected for the singular project draft at a time.
- Start and end controls step across real transcript word boundaries or accept millisecond-precise numeric edits.
- Boundary changes always reference the uploaded original source. AI cuts start at no more than 45 seconds; manual edits may extend the combined timeline to 60 seconds, with at most three source segments.
- Users can add another source segment when duration and segment slots remain; the editor autosaves it before requesting a segment-scoped proxy and restores transcript-aligned captions when that source range becomes available.
- Delete and reorder operations preserve stable segment IDs and normalize `order` from zero.
- Changes inside proxy handles update immediately without media processing.
- Changes beyond handles are saved immediately, then queue a replacement for that segment only. The editor polls until the new signed proxy covers the edited range.
- Autosave waits 900 ms after an edit. A revision conflict requires an explicit reload.

## Local verification

```bash
npm run test:video-workspace
npm run check-locales
npx tsc --noEmit
npm run build
```

Apply migrations to a fresh isolated local D1 database when validating the full schema chain. No remote migration or deployment is part of the local milestone.
