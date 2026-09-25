# Homepage media and feature demonstrations

## Current design — 2026-09-25, v6

The public homepage follows a centered headline and CTA, one large Hero film, a clip wall, six looping feature demonstrations, an upload/refine/publish workflow, three audience cards and a publishing-oriented final CTA. Signed-in users retain the existing uploader. No persistent preview server should be started when the user reserves that step for themselves.

- `VideoHomeDemo.tsx`: 24-second silent autoplay Hero loop and poster, with no controls. Per the owner’s explicit request, Hero autoplay is enabled independently of reduced-motion settings. Offscreen/hidden-tab playback still pauses. Rebuilt in v6 from Pexels stock; see [Hero narrative](#hero-narrative).
- `HomeLoopVideo.tsx`: shared client loop for every other homepage video. Silent, `preload="none"`, plays while at least 30% visible, pauses offscreen or in a hidden tab, and shows only the poster to reduced-motion viewers.
- `VideoHomeClipWall.tsx`: ten 540 × 960 vertical shorts directly below the Hero, each a different person and category, in one full-width row that scrolls continuously (CSS marquee over two copies of the set; the copy is `aria-hidden`). It always scrolls by default and pauses only on mouse hover; there is intentionally no pause button. Reduced-motion viewers get a manual scroll-snap row instead. Captions are inside the video, so there is no text below the cards; the sample hook is the video's accessible label.
- `VideoHomeShowcase.tsx`: six 1280 × 720 feature loops (selection, framing, captions, trim, cover, publishing) and the workflow cards (a 640 × 360 source loop plus three 160 × 284 portrait frames from the same video).
- `VideoHomeMarketing.tsx`: creators, podcasters and teams cards, each with an 810 × 600 loop; FAQ and final CTA.
- Copy and accessible labels are localized in six dictionaries. Clip ids, categories, sample hooks and asset ordering remain in TypeScript. Captions inside the media are English sample text.

## Stock footage and honesty boundaries

All v6 media, including the Hero, is built from [Pexels](https://www.pexels.com/license/) stock clips: free for commercial use, attribution not required. Pexels does not permit implying that the people shown endorse a product, so the clip wall note and `presentation.illustrationNote` state that the footage is licensed stock, the captions and titles are sample text, and the people do not endorse Scribix. Do not add names, testimonials, view counts, virality scores or captions that read as endorsements.

Every person appears in exactly one place. The workflow cards intentionally reuse one person across their source and portrait frames because they depict one video moving through the product; likewise the Hero's three clips are one cottonbro studio interview.

| Role | Output | Pexels video id | Trim |
| --- | --- | --- | --- |
| Clip wall · Podcast | `wall-01` | 7586489 | 0–8 s |
| Clip wall · Streaming | `wall-02` | 8048247 | 2–10 s |
| Clip wall · Business | `wall-03` | 7414133 | 0–7 s |
| Clip wall · Education | `wall-04` | 8617284 | 8–16 s |
| Clip wall · Keynote | `wall-05` | 14791149 (page id 34917491) | 0–8 s |
| Clip wall · Cooking | `wall-06` | 12691778 | 8–16 s |
| Clip wall · Storytelling | `wall-07` | 6248321 | 5–13 s |
| Clip wall · Travel | `wall-08` | 7823739 | 0–8 s |
| Clip wall · Tech | `wall-09` | 6332572 | 4–12 s |
| Clip wall · Beauty | `wall-10` | 7594692 | 3–11 s |
| Feature · Moment selection | `feature-selection` | 8529661 | 4–12 s |
| Feature · Framing | `feature-framing` | 16068998 (page id 37874102) | 10–18 s |
| Feature · Captions | `feature-captions` | 7999352 | 0–8 s |
| Feature · Trim | `feature-trim` | 6985493 | 6–14 s |
| Feature · Cover | `feature-cover` | 8626274 | 0–8 s |
| Feature · Publishing | `feature-package` | 4569680 | 2–10 s |
| Workflow source and frames | `workflow-*` | 5977274 | 0–6 s; frames at 2, 7, 12 s |
| Audience · Creators | `audience-creators` | 8171436 | 0–8 s |
| Audience · Podcasters | `audience-podcasters` | 16406864 (page id 38630465) | 10–18 s |
| Audience · Teams | `audience-teams` | 6339833 | 4–12 s |
| Hero · Wide two-shot | `source`, `short-crop` | 6878732 | 0–20 s; crop 6–14 s |
| Hero · Guest | `short-guest` | 6883839 | 0–8 s |
| Hero · Host | `short-host` | 6883833 | 5–13 s |

Pexels download filenames for newer uploads differ from the page ids; both are listed where they differ.

Feature loops mirror real product behaviour: framing modes `fill`/`fit`/`auto`, the `karaoke-v1`, `boxed-v1` and `minimal-v1` caption templates with `#FFD600` highlight at 78% height, opening titles at 22%, and cover titles at 78% height (`final-render.mjs`). Moment titles, transcripts, timestamps, account names and publishing statuses are illustrative. The publishing loop shows an explicit Publish action and "Submitted" states, not live posts or provider acceptance.

### Delivery

- `public/media/home-loops/wall-01…10.{mp4,jpg}`: 540 × 960, 30 fps, H.264 CRF 26, no audio, fast-start, poster at 1 s.
- `public/media/home-loops/feature-*.{mp4,jpg}`: rendered at 1600 × 900, delivered at 1280 × 720, CRF 25.
- `public/media/home-loops/workflow-source.{mp4,jpg}`, `workflow-clip-{0,1,2}.jpg`, `audience-*.{mp4,jpg}`: plain stock trims, CRF 27.
- About 11 MB in total; every video loads only when it approaches the viewport.

See [rendering instructions](../scripts/homepage-media/README.md#stock-footage-loops-v6). Stock sources and render masters stay under ignored `.artifacts/homepage-film/`.

### Retired in v6

- `public/media/home-features-v3/*.webp` (generated-photo feature stills) and `public/media/home-artwork/*.webp` (generated photos) were removed; no render uses them any more.
- The Hero no longer uses the `Vision-Future-compressed` interview footage or its real Scribix clip exports, and the Arial `body.ttf` was replaced by Geist (`prepare.mjs` copies the variable font from `next`).
- The real-output clip wall (`public/media/home-clips/`, Creative Commons test-account finals) was never committed and was replaced before release.

## Hero narrative

| Time | Intent | Media |
| --- | --- | --- |
| 0–6 s | Original conversation → finished shorts, with platform destinations visible | `source` from 0; `short-guest`, `short-host`, `short-crop` from 0 |
| 6–12 s | Landscape → portrait composition | `source` from 6 s with the crop window outlined; `short-crop` from 0 |
| 12–18 s | Captioned output and styling | `short-guest` from 0 |
| 18–24 s | Multiple selected accounts → publish action → submission states | `short-host` from 0; illustrated YouTube, TikTok and LinkedIn account rows |

`short-crop` is a plain full-height 9:16 window (x 2700–3915 of the 4096-wide source) starting at the same second as the framing scene's `source` excerpt, so the outlined window and the output show the same frames. `short-guest` and `short-host` are Pexels' own portrait angles of the same interview. Each film scene has its own Remotion Sequence to keep media offsets correct. The publishing sequence is a **visual demonstration**, not a live operation or speed measurement. No OAuth or social post is performed during media production.

## Hero proof boundaries

The Hero is illustrative, not a Scribix export. The stock footage has no usable speech, so caption words (`CUES` in `composition.jsx`) are sample text styled like `karaoke-v1`. Waveforms, crop outlines, buttons and publishing status transitions are schematic. Platform support is based on `app/components/publishing/shared/specs.ts`, the account/compose implementation and `docs/video-workspace/social-publishing.md`. Direct publishing requires a paid plan and connected accounts. Do not add unsupported platforms or claim provider acceptance based on an illustration.

## Hero assets and reproduction

- `public/media/home-demo/scribix-hero-v5.mp4` and `.jpg`: 1600 × 900, 30 fps, 24 seconds, H.264, no audio, fast-start metadata; poster at second 1.

See [rendering instructions](../scripts/homepage-media/README.md). Remotion creates the layouts and motion; FFmpeg trims the stock, removes audio and prepares delivery metadata. Application runtime has no Remotion dependency. The original `scribix-hero` video and `home-variety` assets remain archival and are not referenced by the new homepage. Intermediate v2–v4 renders were not retained.

## Retired licensed footage provenance

The previous lower-page licensed source materials remain in `public/media/home-variety/`, but are no longer displayed by these homepage components:

- [Steve Wozniak interview](https://commons.wikimedia.org/wiki/File:Interview_with_Steve_Wozniak.webm): ConversationEDU, CC BY 3.0.
- [Ellen Gertsen introduction](https://www.youtube.com/watch?v=FjJxkNtCCAU): [NASA licensing reference](https://science.nasa.gov/researchers/pi-launchpad-sessions/), Creative Commons Attribution.
- [Robotics interview](https://commons.wikimedia.org/wiki/File:Was_macht_ein_Roboterforscher%3F.webm): ZDF/logo/Simone Klein, CC BY 4.0.
- [WikiLearn lesson](https://commons.wikimedia.org/wiki/File:WCC_module_5_-_23_-_re-using_freely-licensed_media.webm): Asaf (WMF), CC BY-SA 4.0. Adapted excerpts retain that license and embedded credits.

Restore attribution beside these materials if they are reused in a future homepage section.

## Verification

Run `npm run check-locales` and `npm run build:cloudflare` (includes the Next production build). Verify media dimensions, duration, audio absence and fast-start order, inspect contact sheets of every loop and the Hero film, and compare public assets with `.open-next/assets/`.

For v3, the existing user-started local server was used in Chrome ai-publisher. The public page was inspected through 127.0.0.1 to avoid altering the signed-in localhost session. Desktop checks cover the Hero, illustration loading, publishing section and new workflow. Mobile and dark-theme browser acceptance are not yet established by that check. No new website server, production deployment, login change or real publication was performed.

### v4 refinement

The publishing scene uses 680 × 112 destination cards instead of 935 × 158, with the clip and connections centered as a compact group. Channel badges share a fixed icon slot, with optical sizing that accounts for YouTube’s built-in clear space. Shared publishing-workspace icons are unchanged. The existing `local.scribix.io` tunnel was started at the owner’s request using `.wrangler/scribix-local-tunnel.token`; its ingress remains `http://localhost:3000`. Do not print the token or other tunnel process command lines.

### v5 visual consistency

All four Hero scenes use the same fixed light canvas (`#f0ebf8`), including publishing. The publishing headline and supporting labels use dark text; the standalone lower-page publishing illustration retains its own dark treatment. The video container shares the desktop H1 maximum width through `--hero-content-width`, is centered, and fits the available mobile width.
