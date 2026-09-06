# Automatic framing and active-speaker follow

Status: implemented and verified locally; not deployed. Current analyzer: `mediapipe-talknet-v4`.

## Pipeline and shared geometry

Scribix runs MediaPipe BlazeFace and TalkNet inside the video container. The pinned upstream architecture and MIT notice live in `containers/video-preview/talknet/`; Docker downloads checksum-verified model weights at build time. No external analysis service, identity recognition, or stored face embeddings are required.

Preview jobs analyze their bounded source interval once. `media_assets.auto_framing_json` stores source-time framing decisions shared by the editor, cover preview, thumbnails, and final renderer. New defaults use Auto. Existing saved Fill/Fit choices and manual time ranges remain intact; unanalyzed trim extensions use Fit. Analysis failures preserve a usable full-frame preview with a retry action.

The analyzer detects source cuts before evaluating 2-second audiovisual windows at 25 fps. Faces are detected at 5 Hz and linked geometrically within each shot. IoU association tolerates up to one second of missed detections; ambiguous matches end tracks. Each track is scored independently, so another missed face cannot prevent analysis of the visible speaker. Two confident windows can backfill the opening where the selected track was observed. Speaker selection requires a score of at least 0.8 and a 0.25 margin when comparing two people; handoffs require consecutive evidence. A single visible person can be framed in a reaction shot without claiming they are speaking.

Each subject run uses one fixed union crop with conservative head/shoulder margins and downward-quantized zoom. This prevents per-window size fluctuations. It is a face-derived safety estimate, not body segmentation; missing source pixels cannot be recovered. Low-confidence intervals without a stable subject retain the full frame. Tracks reset at source cuts and do not establish identity across shots or reliably handle crossing people.

## Manual framing and playback

Manual section adjustments accept 0.1–4× relative to fill scale. Users drag the picture inside the portrait canvas; Full frame, Fill frame and restore-auto actions affect only the selected section. Exposed canvas uses the saved background color. Browser and FFmpeg alignment agree: pad undersized axes before cropping oversized axes. Automatic render segments split at changes in mode, zoom or vertical alignment.

The clip editor retains its central round play/pause button. Clicking toggles playback and hides the icon; mouse movement reveals it for 1.5 seconds. On touch, tapping a hidden control reveals it before a subsequent tap toggles playback. Keyboard activation remains available.

The final renderer trims decoded video and audio before timestamp normalization and framing. Input `-t` alone can leak B-frames from the next shot through the previous crop. This fix preserves editorial timings; it does not add crossfades or eliminate every possible source/proxy frame-rate offset.

## Validation and limits

The Vision-Future project was regenerated from its existing AI highlights, without repeating summary or highlight extraction. Clip 4 served as the acceptance sample for opening-shot tracking and cut-boundary fixes, then clips 1, 2, 3 and 5 were regenerated. Updated output assets and project records are local-app results, not a production rollout. The lower homepage portrait examples also use this pipeline; see `docs/homepage-media.md`.

- `npm run test:video-workspace` and `npm run test:video-consistency` check shared geometry, manual overrides and plan boundaries.
- `python3 scripts/video-workspace/test-speaker-framing.py` checks geometry, missed faces, independent tracks, opening backfill and subject handoffs.
- `npm run test:video-final` includes a 23.976fps H.264 B-frame source with fractional cut timing and opposite-side subjects; all 105 output frames must retain the correct subject. Run renderer checks in the built container when local FFmpeg dependencies differ.
- `SCRIBIX_FRAMING_DIAGNOSTICS=1` writes local aggregate track positions, counts and scores for investigation. It is off by default; model scores are not measured accuracy percentages.

Full-frame/close-up source edits remain visible. A one-frame scale change was observed in another sample due to source/proxy cut alignment; decoded-frame trimming does not address that separate offset. Broader annotated footage is needed to measure wrong-person screen time, switch latency and CPU cost before making general accuracy claims.

## Rollout

Apply `0037_auto_framing.sql` before deploying the app/worker and rebuild the video container image. The migration has been applied locally only. Deploy editor validation and container integration together: old renderers cannot export zoom-out drafts. The zoom-range change requires no additional migration beyond the auto-framing column.

Existing plans and exports remain unchanged until explicitly reanalyzed and rendered. Reprocessing must reuse saved highlights and preserve captions and editorial timing unless the user requests new selection. Keep original exports available during acceptance.

## Upstream references

- Google face detector: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector
- TalkNet author repository: https://github.com/TaoRuijie/TalkNet-ASD
- TalkNet paper: https://arxiv.org/abs/2107.06592
