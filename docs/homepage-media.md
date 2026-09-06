# Homepage media and feature demonstrations

## Components and behavior

- `app/components/VideoHomeHero.tsx` shows `VideoHomeDemo` to signed-out visitors. The 15-second Hero uses an existing Scribix project's source and exported clips. Its visual-first sequence shows timeline selection, three real outputs, then one enlarged portrait export beside the source. Only short functional labels and the source aspect ratio remain; do not restore a brand lockup, marketing headlines, clip titles or a text-heavy closing slide inside the video.
- `app/components/VideoHomeShowcase.tsx` owns the source-format gallery, lesson selection, framing comparison, caption styles, video-only interview card, workflow illustrations and source credits.
- `app/components/VideoHomeMarketing.tsx` assembles these sections with audiences, FAQ and the final upload CTA.
- `useHomeVideoLoop.ts` plays muted, looping, inline video with no native controls. It pauses outside the viewport, in a hidden tab, or under reduced motion, and resumes when eligible. Posters remain available if autoplay is blocked.
- The interview card is video-only: do not restore Reset, start/end sliders, duration readouts or interactive-preview instructions. Lesson selection and caption-style buttons remain interactive.
- Homepage copy lives in `VideoHome.demo` and `VideoHome.showcase` in all six message files. Keep asset IDs, URLs, timing and source data in code.

## Proof versus illustration

The Hero contains real project output. Its waveform, selection ranges, processing ribbons and portrait outline are schematic, not processing-speed measurements or tracking telemetry. Captions are baked into the original exports. The main source excerpt starts at 406.679 seconds to align with the primary candidate starting at 390.479 seconds, shown from output second 20 at demo second 3.8; the two secondary cards use separate output excerpts. The source-format gallery and feature demonstrations use licensed source excerpts prepared for the homepage; they are not completed Scribix project exports or customer endorsements. The portrait framing and caption media now run through the same MediaPipe/TalkNet v4 analysis and final renderer used by the product; selection times remain manually chosen, not AI-selected highlights. Keep this distinction in copy. Do not introduce invented AI scores or output counts.

Caption cues use the supplied Ellen Gertsen SRT, shifted by 30.07 seconds. They are phrase-level cues, not word-level timing. Clean/Focus styles render as HTML over the video and are not baked into its MP4.

## Assets

`public/media/home-demo/` contains the Hero MP4 and poster. `public/media/home-variety/` contains the current lower-page media. These delivery MP4s are short, silent H.264 loops with fast-start metadata; the full source recordings must not be bundled into the website.

| Asset stem | Source | Source start | Duration | Display |
| --- | --- | --- | --- | --- |
| interview | ConversationEDU, Interview with Steve Wozniak | 00:30 | 10 seconds | 960 × 540; preserves camera cuts and both speakers |
| lecture | Ellen Gertsen, Introduction | 09:04 | 10 seconds | 960 × 540; full slides |
| captions | Ellen Gertsen, Introduction | 00:30.07 | 10 seconds | 540 × 960; automatic framing v4; fixed shot crop, zoom 0.8 |
| robotics | ZDF, Was macht ein Roboterforscher? | 01:41 | 10 seconds | 960 × 540 |
| robotics-portrait | Same robotics excerpt | 01:41 | 10 seconds | 540 × 960; automatic framing v4; shot-aware crop / zoom / fit |
| lesson-1 / lesson-2 / lesson-3 | WikiLearn, Re-using freely-licensed media | 00:30 / 04:54 / 08:19 | 10 seconds each | 960 × 540; retains screen and speaker inset |

Each stem has a matching JPG poster. The old `home-features` files and unused `interview-portrait` are not required by the current homepage.

## Attribution

The `VideoMediaCredits` disclosure at `#home-media-credits` links the source and license and identifies the adaptations. Preserve the credits when replacing or reusing assets.

- [Steve Wozniak interview](https://commons.wikimedia.org/wiki/File:Interview_with_Steve_Wozniak.webm): ConversationEDU, CC BY 3.0.
- [Ellen Gertsen introduction](https://www.youtube.com/watch?v=FjJxkNtCCAU): [NASA workshop licensing reference](https://science.nasa.gov/researchers/pi-launchpad-sessions/), Creative Commons Attribution.
- [Robotics interview](https://commons.wikimedia.org/wiki/File:Was_macht_ein_Roboterforscher%3F.webm): ZDF/logo/Simone Klein, CC BY 4.0.
- [WikiLearn lesson](https://commons.wikimedia.org/wiki/File:WCC_module_5_-_23_-_re-using_freely-licensed_media.webm): Asaf (WMF), CC BY-SA 4.0. Adapted excerpts are shared under the same license; embedded example-image credits remain in the original recording.

## Local verification

Run `npm run build:cloudflare` to rebuild the OpenNext assets used by the local Wrangler preview at port 3000. An ordinary Next build alone does not refresh that preview. This build does not deploy the site.

Check desktop/mobile layouts, both themes, poster loading, silent looping without controls, lesson selection, caption style/cue changes and source credits. Preserve reduced-motion behavior. Full source masters and the editable Hero composition are local production inputs, not repository dependencies. The current editable revision is `/Users/laughingli/Documents/Codex/2026-09-05/x/outputs/scribix-hero-visual/`; it includes the asset ledger, timing notes, HyperFrames source and 1920 × 1080 master. The website serves a 1280 × 720 derivative and a poster from 10.9 seconds.

## Lower-page regeneration — 2026-09-06

All eight current loops and their posters were regenerated from the same licensed masters and time ranges. Six landscape excerpts retain the whole frame, including slides and speaker insets. `robotics-portrait` and `captions` use `speaker-framing.py` (mediapipe-talknet-v4) and `renderFinal` from `containers/video-preview/final-render.mjs`, including the decoded-frame trim before cropping at shot boundaries. Analysis receives source audio; audio is removed only from the website derivative. Captions remain HTML overlays using the existing cues and style controls. The Hero is unchanged.

The caption example holds one crop for all 10 seconds, at zoom 0.8. Robotics uses separate stable crops per source shot; its close-up zooms out to protect the face, and the final question card stays in fit mode so the text remains readable. These deliberate source-shot changes are not continuous animated zooms.

Local reproducibility inputs: `/Users/laughingli/Documents/Codex/2026-09-05/x/outputs/homepage-sources/` contains the masters. `.wrangler/home-demo-refresh/run.py` prepares the excerpts and invokes the installed Docker analysis image; `render.mjs` invokes the current final renderer. The same folder retains plans, diagnostics, full-resolution renders, delivery derivatives and previous website assets. Run from the repository root with `python3 .wrangler/home-demo-refresh/run.py`; it stages delivery files without publishing them. These local production inputs are not runtime dependencies.

Video and poster URLs include a media revision to refresh cached loops and posters together. The three Next Image workflow thumbnails use plain local paths because the image configuration rejects query strings. Validation included duration, dimensions, no audio, H.264/pixel format, fast-start metadata, full-loop contact sheets, and consecutive-frame inspection at the robotics cuts.
