# 视频编辑、字幕与构图

2026-09-14 按主题合并现行合同，替代分散的阶段文件。以下本地验证和历史测量不等于生产验收；功能状态与优先级统一见[产品 plan](../roadmap/video-product-plan.md)。

[编辑与草稿](#editing) | [字幕与品牌](#styles) | [自动构图与说话人跟随](#framing)

<a id="editing"></a>

## 编辑与草稿

M4 turns any selected AI candidate into its own persistent, transcript-aligned draft. The top gallery selects one clip at a time; the browser composes that clip's existing per-segment proxies into a continuous virtual timeline and saves source-time EDL changes without overwriting edits made to another candidate.

### Plan access

- Creator and grandfathered Basic users can open the editor, change clip boundaries, and use brand controls.
- Free users do not receive the editor API or brand controls. They can select and preview an AI candidate, then use the generated-clip export surface to render it exactly as generated.
- `lib/video-workspace/access.ts` is the shared policy source. The editor, candidate, brand-asset, and render routes enforce it on the server; hiding controls is not the security boundary.

### Time model

- `sourceStartMs` / `sourceEndMs` remain the durable edit and final-render truth.
- `proxySourceStartMs` / `proxySourceEndMs` describe which source interval a proxy contains.
- `proxyStartMs = sourceStartMs - proxySourceStartMs` seeks into a proxy.
- `timelineStartMs` / `timelineEndMs` are recomputed from ordered EDL duration, preserving continuous playback for any stored multi-segment draft.

`lib/video-workspace/timeline.ts` owns these mappings and word-boundary stepping. The player keeps two video elements: the active proxy plays while the next proxy is preloaded, then the slots swap at a segment boundary.

### Draft and snapshot API

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

Migration `0028_video_editor_drafts.sql` adds the active project draft mirror. Migration `0032_clip_candidate_origin.sql` distinguishes AI recommendations from the direct original-source editor entry. Migration `0033_candidate_drafts.sql` stores an independent draft on every candidate and records candidate ownership on immutable project versions. All must be applied remotely before deploying the current editor.

### Editing behavior

- Only one candidate is selected for the singular project draft at a time.
- Start and end controls step across real transcript word boundaries or accept millisecond-precise original-video timecodes such as `02:03.637`.
- Boundary changes always reference the uploaded original source. AI cuts and manual boundary edits share the 90-second contract limit; the short-source direct-edit threshold remains 45 seconds.
- Auto follows the saved analysis; Fit preserves the full source frame. Manual section editing supports dragging and zooming within a 9:16 canvas. The current section workflow is described below; it replaces early axis-slider controls.
- The current product does not expose add, delete, or reorder controls for cuts. Existing multi-segment drafts remain valid and play in their stored order, but ordinary editing stays focused on one understandable source range.
- Paid users can create multiple independent manual candidates from the Original video workspace, without first generating AI candidates. Select word boundaries or enter start/end times (up to 90 seconds), preview the original range, then create the candidate. The source-clips endpoint checks ownership, expiry, edit access and immutable request IDs. The legacy default-range endpoint still reuses its existing manual candidate. Deleting a selected custom clip removes only its associated drafts, jobs and outputs; other manual and AI candidates are preserved. AI candidate replacement now preserves manual candidates.
- Changes inside proxy handles update immediately without media processing.
- Changes beyond handles are saved immediately, then queue a replacement for that segment only. The editor polls until the new signed proxy covers the edited range.
- Autosave waits 900 ms after an edit. A revision conflict requires an explicit reload.

### Local verification

```bash
npm run test:video-workspace
npm run check-locales
npx tsc --noEmit
npm run build
```

Apply migrations to a fresh isolated local D1 database when validating the full schema chain. No remote migration or deployment is part of the local milestone.

### Publish preparation (2026-09-08)

The saved per-clip draft now includes `publishDraft`, guarded by the same revision as the EDL and Render Spec. Prepare to publish generates opening titles, independent cover text and editable post copy together; manual changes survive regeneration. Optional `openingTitle` and `coverTitle` render fields default off for legacy drafts. Content edits retain copy with a review notice; removed cover frames remap to the beginning. Copy and cover changes do not invalidate video dependencies. See [publish preparation](publish-preparation.md) for concurrency, snapshot, permission and validation contracts.

### Manual sections and caption controls

The persistent manual framing editor opens existing source-time sections. Users select sections using thumbnails, click the framing timeline to seek, split at the playhead, move shared boundaries, merge with a neighbour, change crop/zoom, or restore automatic framing for a section. Merge keeps the neighbour’s framing and all footage; source cuts stay fixed. Undo restores session snapshots. Save adjustments commits the draft once; Cancel discards it. Existing settings outside trimmed footage remain preserved. `lib/video-workspace/framing-sections.ts` owns conversion and composition.

Selecting a section scopes the main preview and scrubber to that interval; playback stops at its end and replay starts at its beginning. An entire-clip preview toggle remains available. Pending framing edits disable export and show a save/cancel instruction so the preview cannot be mistaken for the saved export. These framing operations do not add, delete or reorder spoken content.

Automatic analysis runs during preview preparation. The user-triggered reanalysis/proposal UI was removed; the preview rebuild endpoint only repairs missing or insufficient coverage. Users correct unwanted framing through manual sections. Existing drafts keep their saved framing.

`captions.fontScale` permits 50–150% of the selected template default and defaults to 1 for old drafts; preview, cover overlays where applicable, and ASS apply the shared value. Advanced caption options and the collapsed correction list are separate; the expanded correction list has bounded scrolling.

Local checks from 2026-09-05 covered draft persistence, split/move/merge/undo, scoped playback, crop dragging, caption scale and saved-spec preservation, plus contract, locale and Cloudflare builds. Earlier proposal-UI checks apply only to the removed UI. These records do not establish deployment or current full-account acceptance.

<a id="styles"></a>

## 字幕与品牌

M5 extends the immutable Render Spec contract and implements the same controlled values in the browser preview. The UI never accepts arbitrary CSS, font paths, FFmpeg filters or overlay URLs.

### Renderer-owned parameters

- Per-segment crop uses normalized `x`, `y` and `zoom` values.
- Caption templates are stable IDs: `karaoke-v1`, `boxed-v1` and `minimal-v1`.
- Caption cues retain source-time word boundaries and a stable segment ID. Correction rows display each cue's original-video time interval so the segmentation is understandable.
- Caption line width, line count, position and colors have bounded numeric or hex-color fields.
- Brand templates, logo position, logo scale and accent color are enum/bounded values.
- Audio is fixed to the original source sound: 0 dB gain, no loudness normalization, and no fades. The Render Spec retains these fields for contract compatibility, but the editor exposes no audio controls.
- Cover selection stores one exact virtual timeline millisecond and seeks the browser preview to it.

The browser draws a 5% safe-area guide and constrains captions and logos inside it. `VideoClipEditor` and `VideoStyleControls` mutate only the shared `RenderSpec` type; the autosave endpoint performs the same server validation before persistence.

### Caption correction

Transcript words are grouped into six-word cues when a draft is first created. A correction replaces the text tokens while preserving the cue interval; if the token count changes, word intervals are redistributed deterministically inside the original cue. Trimming a segment clips or removes caption words that fall outside the new EDL range.

### Logo and font assets

`POST /api/video-projects/:id/brand-assets` creates a project-owned pending asset and returns a 15-minute object-scoped PUT URL. Supported V1 files are:

- Logo: PNG, JPEG or WebP, maximum 5 MiB.
- Font: TTF or OTF, maximum 5 MiB.

After direct upload, `POST /api/video-projects/:id/brand-assets/:assetId` verifies the R2 object exists and its size matches before marking it ready. `DELETE /api/video-projects/:id/brand-assets/:assetId` removes the owned R2 object and soft-deletes the project asset; removing the selected logo also clears the draft's brand selection. Draft save separately verifies that selected logo/font IDs are ready, correctly typed, project-owned assets. Content headers are magic-byte validated before an upload becomes ready.

### External R2 CORS setting

Direct browser uploads require the private `scribix-media` bucket CORS policy to allow the production application origins to issue `PUT` requests with `Content-Type`. Do not use `*` for production origins. Include local development origins only in the development policy.

No R2 policy, remote migration or deployment was changed during local implementation.

<a id="framing"></a>

## 自动构图与说话人跟随

Status: deployed in the production video container. Current analyzer: `mediapipe-talknet-v4`.

### Pipeline and shared geometry

Scribix runs MediaPipe BlazeFace and TalkNet inside the video container. The pinned upstream architecture and MIT notice live in `containers/video-preview/talknet/`; Docker downloads checksum-verified model weights at build time. No external analysis service, identity recognition, or stored face embeddings are required.

Preview jobs analyze their bounded source interval once. `media_assets.auto_framing_json` stores source-time framing decisions shared by the editor, cover preview, thumbnails, and final renderer. New defaults use Auto. Existing saved Fill/Fit choices and manual time ranges remain intact; unanalyzed trim extensions use Fit. Analysis failures preserve a usable full-frame preview; users can correct framing manually. Preview rebuilding repairs missing coverage, not user-requested speaker reanalysis.

The analyzer detects source cuts before evaluating 2-second audiovisual windows at 25 fps. Faces are detected at 5 Hz and linked geometrically within each shot. IoU association tolerates up to one second of missed detections; ambiguous matches end tracks. Each track is scored independently, so another missed face cannot prevent analysis of the visible speaker. Two confident windows can backfill the opening where the selected track was observed. Speaker selection requires a score of at least 0.8 and a 0.25 margin when comparing two people; handoffs require consecutive evidence. A single visible person can be framed in a reaction shot without claiming they are speaking.

Each subject run uses one fixed union crop with conservative head/shoulder margins and downward-quantized zoom. This prevents per-window size fluctuations. It is a face-derived safety estimate, not body segmentation; missing source pixels cannot be recovered. Low-confidence intervals without a stable subject retain the full frame. Tracks reset at source cuts and do not establish identity across shots or reliably handle crossing people.

### Manual framing and playback

Manual section adjustments accept 0.1–4× relative to fill scale. Users drag the picture inside the portrait canvas; Full frame, Fill frame and restore-auto actions affect only the selected section. Exposed canvas uses the saved background color. Browser and FFmpeg alignment agree: pad undersized axes before cropping oversized axes. Automatic render segments split at changes in mode, zoom or vertical alignment.

The clip editor retains its central round play/pause button. Clicking toggles playback and hides the icon; mouse movement reveals it for 1.5 seconds. On touch, tapping a hidden control reveals it before a subsequent tap toggles playback. Keyboard activation remains available.

The final renderer trims decoded video and audio before timestamp normalization and framing. Input `-t` alone can leak B-frames from the next shot through the previous crop. This fix preserves editorial timings; it does not add crossfades or eliminate every possible source/proxy frame-rate offset.

### Validation and limits

The Vision-Future project was regenerated from its existing AI highlights, without repeating summary or highlight extraction. Clip 4 served as the acceptance sample for opening-shot tracking and cut-boundary fixes, then clips 1, 2, 3 and 5 were regenerated. Updated output assets and project records are local-app results, not a production rollout. The lower homepage portrait examples also use this pipeline; see `docs/homepage-media.md`.

- `npm run test:video-workspace` and `npm run test:video-consistency` check shared geometry, manual overrides and plan boundaries.
- `python3 scripts/video-workspace/test-speaker-framing.py` checks geometry, missed faces, independent tracks, opening backfill and subject handoffs.
- `npm run test:video-final` includes a 23.976fps H.264 B-frame source with fractional cut timing and opposite-side subjects; all 105 output frames must retain the correct subject. Run renderer checks in the built container when local FFmpeg dependencies differ.
- `SCRIBIX_FRAMING_DIAGNOSTICS=1` writes local aggregate track positions, counts and scores for investigation. It is off by default; model scores are not measured accuracy percentages.

Full-frame/close-up source edits remain visible. A one-frame scale change was observed in another sample due to source/proxy cut alignment; decoded-frame trimming does not address that separate offset. Broader annotated footage is needed to measure wrong-person screen time, switch latency and CPU cost before making general accuracy claims.

### Rollout

Apply `0037_auto_framing.sql` before deploying the app/worker and rebuild the video container image. The migration has been applied locally only. Deploy editor validation and container integration together: old renderers cannot export zoom-out drafts. The zoom-range change requires no additional migration beyond the auto-framing column.

Existing plans and exports remain unchanged until explicitly reanalyzed and rendered. Reprocessing must reuse saved highlights and preserve captions and editorial timing unless the user requests new selection. Keep original exports available during acceptance.

### Upstream references

- Google face detector: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector
- TalkNet author repository: https://github.com/TaoRuijie/TalkNet-ASD
- TalkNet paper: https://arxiv.org/abs/2107.06592

### 2026-09-15: local CPU compatibility and failure diagnostics

The Good Woman Trap's five preview assets initially contained `analysis-unavailable-v1`, not successful speaker tracking. Reproduction through the actual queue recorded `SIGILL` after approximately 2.6 seconds: the MediaPipe 1.0.1 Linux binary requires AVX that the local AMD64 emulation does not expose. A direct Python-as-PID-1 experiment misleadingly continued after the native failure; model tests must use the real Node → Python subprocess boundary.

The container now pins MediaPipe 0.10.21, JAX/JAXlib 0.4.30, NumPy 1.26.4 and OpenCV 4.10.0.84. Speaker analysis uses that release's bundled full-range FaceDetection graph; its Tasks FaceDetector assumes short-range tensor dimensions and cannot substitute for the full-range graph. The Docker build executes actual frame inference from a Node-spawned Python process. TalkNet, selection thresholds and conservative crop policy remain unchanged. Analysis output is tagged `mediapipe-talknet-v5`.

`auto_framing_started`, `auto_framing_completed` and `auto_framing_fallback` record the job ID, source interval and elapsed time. Failure records include a stable reason, exit code, signal and at most 4 KiB of sanitized stderr; source URLs and file paths are redacted. Successful records include fill/fit point counts, which are diagnostic counts, not accuracy scores. Per-track positions/scores still require the existing opt-in diagnostics flag. The editor displays the existing analysis-unavailable notice and adopts and saves repaired analysis when the saved plan was missing or a fallback, preserving crop mode, manual ranges, captions and publishing copy.

Validation commands: `npm run test:framing-analysis`, `python3 scripts/video-workspace/test-speaker-framing.py`, `npm run test:video-workspace`, `npm run build:cloudflare`, and the Docker build's real inference smoke check. The three-person regression selects the middle subject when audiovisual scores support that subject. Production runtime and platform publishing are not covered by local acceptance.

Real local reanalysis of project `982ebb5f-95ca-46e2-a151-967e0294c215` completed for all five previews using v5. Recorded analysis times were 39.7 / 33.3 / 26.2 / 14.5 / 27.3 seconds respectively, with no process-failure fallback. Within the selected cuts, crop coverage was:

| Clip | Crop coverage | Cut duration |
| --- | --- | --- |
| 1 | 44.3 s | 44.3 s |
| 2 | 42.7 s | 44.3 s |
| 3 | 35.4 s | 37.8 s |
| 4 | 12.8 s | 20.8 s |
| 5 | 31.7 s | 39.7 s |

Coverage measures the plan's fill intervals, not speaker-selection accuracy. Uncertain intervals still use the full frame. Chrome ai-publisher visually confirmed that clip 1 now frames the middle participant in the editor instead of the original three-person wide composition. Existing saved EDL, captions, opening title, cover settings and publishing copy for clips 1/4/5 were compared against a pre-run snapshot and preserved. Clips 2/3 had no saved editor draft before this run. Diagnostic logs and before/after local snapshots are in `/tmp/scribix-framing-debug/` and are temporary, not production telemetry.

All five new final-render jobs completed with nonempty MP4/JPG assets and v5 analysis in their immutable render specifications. Job IDs (clips 1–5):

- Clip 1: `0c692ee9-2898-42e7-9ce6-81dce4873133`
- Clip 2: `9ddfbca8-f2a9-453a-9522-b767ec6c0d81`
- Clip 3: `f869ae5d-c20a-472e-b981-aa3249187af1`
- Clip 4: `82ed19ca-c313-46dc-9bfb-b05635c959cf`
- Clip 5: `ab50db28-4b67-4a71-9759-667be407c743`

Actual user download remains user-owned acceptance; no social platform post or production deployment was performed.
