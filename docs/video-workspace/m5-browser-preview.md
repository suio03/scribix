# M5 Browser Preview and Style Editing

M5 extends the immutable Render Spec contract and implements the same controlled values in the browser preview. The UI never accepts arbitrary CSS, font paths, FFmpeg filters or overlay URLs.

## Renderer-owned parameters

- Per-segment crop uses normalized `x`, `y` and `zoom` values.
- Caption templates are stable IDs: `karaoke-v1`, `boxed-v1` and `minimal-v1`.
- Caption cues retain source-time word boundaries and a stable segment ID. Correction rows display each cue's original-video time interval so the segmentation is understandable.
- Caption line width, line count, position and colors have bounded numeric or hex-color fields.
- Brand templates, logo position, logo scale and accent color are enum/bounded values.
- Audio is fixed to the original source sound: 0 dB gain, no loudness normalization, and no fades. The Render Spec retains these fields for contract compatibility, but the editor exposes no audio controls.
- Cover selection stores one exact virtual timeline millisecond and seeks the browser preview to it.

The browser draws a 5% safe-area guide and constrains captions and logos inside it. `VideoClipEditor` and `VideoStyleControls` mutate only the shared `RenderSpec` type; the autosave endpoint performs the same server validation before persistence.

## Caption correction

Transcript words are grouped into six-word cues when a draft is first created. A correction replaces the text tokens while preserving the cue interval; if the token count changes, word intervals are redistributed deterministically inside the original cue. Trimming a segment clips or removes caption words that fall outside the new EDL range.

## Logo and font assets

`POST /api/video-projects/:id/brand-assets` creates a project-owned pending asset and returns a 15-minute object-scoped PUT URL. Supported V1 files are:

- Logo: PNG, JPEG or WebP, maximum 5 MiB.
- Font: TTF or OTF, maximum 5 MiB.

After direct upload, `POST /api/video-projects/:id/brand-assets/:assetId` verifies the R2 object exists and its size matches before marking it ready. `DELETE /api/video-projects/:id/brand-assets/:assetId` removes the owned R2 object and soft-deletes the project asset; removing the selected logo also clears the draft's brand selection. Draft save separately verifies that selected logo/font IDs are ready, correctly typed, project-owned assets. Content headers are magic-byte validated before an upload becomes ready.

## External R2 CORS setting

Direct browser uploads require the private `scribix-media` bucket CORS policy to allow the production application origins to issue `PUT` requests with `Content-Type`. Do not use `*` for production origins. Include local development origins only in the development policy.

No R2 policy, remote migration or deployment was changed during local implementation.
