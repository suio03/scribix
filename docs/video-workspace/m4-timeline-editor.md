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

Migration `0028_video_editor_drafts.sql` adds `draft_candidate_id` and `draft_revision`. It must be applied remotely before deploying M4.

## Editing behavior

- Only one candidate is selected for the singular project draft at a time.
- Start and end controls step across real transcript word boundaries or accept millisecond-precise numeric edits.
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
