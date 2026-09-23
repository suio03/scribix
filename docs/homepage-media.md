# Homepage media and feature demonstrations

## Current design — 2026-09-19, v5

The public homepage follows a centered headline and CTA, one large Hero film, six independent feature illustrations, a new upload/create/publish workflow, three creator use cases and a publishing-oriented final CTA. Signed-in users retain the existing uploader. No persistent preview server should be started when the user reserves that step for themselves.

- `VideoHomeDemo.tsx`: 24-second silent autoplay loop and poster, with no controls or interactive playback buttons. Per the owner’s explicit request, Hero autoplay is enabled independently of reduced-motion settings. Offscreen/hidden-tab playback still pauses.
- `VideoHomeShowcase.tsx`: server-rendered feature explanations and workflow; new generated-photo illustrations, without duplicated in-image marketing headings.
- `VideoHomeMarketing.tsx`: creators, podcasters and teams; updated FAQ and final CTA. The old licensed-source audience cards, download-only workflow and final portrait stack have been replaced.
- Copy and image descriptions are localized in six dictionaries. Platform lists and asset ordering remain in TypeScript. English content within the demo media is illustrative; adjacent explanations and accessible labels are localized.

## Hero narrative

| Time | Intent | Media |
| --- | --- | --- |
| 0–6 s | Original conversation → finished shorts, with platform destinations visible | source-sync from 0; clip1 from 23 s, clip4 from 8 s, clip3 from 1 s |
| 6–12 s | Landscape → portrait composition | source-sync from 7.8 s; clip1 from 24 s |
| 12–18 s | Captioned output and styling | clip1 from 23 s |
| 18–24 s | Multiple selected accounts → publish action → submission states | clip4 from 10 s; illustrated YouTube, TikTok and LinkedIn account rows |

The source excerpt begins at original second 406.679; clip1 begins at 390.479. The framing pair therefore represents the same moment. Each film scene has its own Remotion Sequence to keep media offsets correct. The publishing sequence is a **visual demonstration**, not a live operation or speed measurement. No OAuth or social post is performed during media production.

## Proof and generated illustration boundaries

Hero source footage and captioned video outputs are from the pre-existing `Vision-Future-compressed` project. Baked captions remain intact. Waveforms, crop outlines, buttons and publishing status transitions are schematic. Platform support is based on `app/components/publishing/shared/specs.ts`, the account/compose implementation and `docs/video-workspace/social-publishing.md`. Direct publishing requires a paid plan and connected accounts. Do not add unsupported platforms or claim provider acceptance based on an illustration.

The six static feature images use generated fictional people and example content:

1. Podcast: suggested moments connected to a source timeline.
2. Cooking instruction: portrait crop and landscape source.
3. Travel storyteller: three visibly different caption treatments.
4. Design educator: transcript-based boundary editing.
5. Cooking, travel and education: independently styled covers.
6. Podcast: three destinations, platform-specific copy and explicit publishing action.

These are neither real customer projects nor endorsements. Example timestamps, spoken words and covers are illustrative. The page identifies this distinction. Do not invent virality scores, reach metrics or promise a fixed number of clips.

## Assets and reproduction

- `public/media/home-demo/scribix-hero-v5.mp4` and `.jpg`: 1600 × 900, 30 fps, 24 seconds, H.264, no audio, fast-start metadata; poster at second 1.
- `public/media/home-features-v3/*.webp`: six 1600 × 900 feature illustrations.
- `public/media/home-artwork/*.webp`: four generated photo assets used by the illustrations and lower-page sections.

See [rendering instructions and exact image-generation prompt](../scripts/homepage-media/README.md). The built-in imagegen tool generated the photo sheet; Remotion creates the layouts and motion, Sharp compresses images, FFmpeg removes audio and prepares delivery metadata. Application runtime has no Remotion dependency. The original `scribix-hero` video and `home-variety` assets remain archival and are not referenced by the new homepage. Intermediate v2–v4 renders were not retained.

## Retired licensed footage provenance

The previous lower-page licensed source materials remain in `public/media/home-variety/`, but are no longer displayed by these homepage components:

- [Steve Wozniak interview](https://commons.wikimedia.org/wiki/File:Interview_with_Steve_Wozniak.webm): ConversationEDU, CC BY 3.0.
- [Ellen Gertsen introduction](https://www.youtube.com/watch?v=FjJxkNtCCAU): [NASA licensing reference](https://science.nasa.gov/researchers/pi-launchpad-sessions/), Creative Commons Attribution.
- [Robotics interview](https://commons.wikimedia.org/wiki/File:Was_macht_ein_Roboterforscher%3F.webm): ZDF/logo/Simone Klein, CC BY 4.0.
- [WikiLearn lesson](https://commons.wikimedia.org/wiki/File:WCC_module_5_-_23_-_re-using_freely-licensed_media.webm): Asaf (WMF), CC BY-SA 4.0. Adapted excerpts retain that license and embedded credits.

Restore attribution beside these materials if they are reused in a future homepage section.

## Verification

Run `npm run check-locales` and `npm run build:cloudflare` (includes the Next production build). Verify media dimensions, duration, audio absence and fast-start order, inspect all six stills and a full-film contact sheet, and compare public assets with `.open-next/assets/`.

For v3, the existing user-started local server was used in Chrome ai-publisher. The public page was inspected through 127.0.0.1 to avoid altering the signed-in localhost session. Desktop checks cover the Hero, illustration loading, publishing section and new workflow. Mobile and dark-theme browser acceptance are not yet established by that check. No new website server, production deployment, login change or real publication was performed.

### v4 refinement

The publishing scene uses 680 × 112 destination cards instead of 935 × 158, with the clip and connections centered as a compact group. Channel badges share a fixed icon slot, with optical sizing that accounts for YouTube’s built-in clear space. Shared publishing-workspace icons are unchanged. The existing `local.scribix.io` tunnel was started at the owner’s request using `.wrangler/scribix-local-tunnel.token`; its ingress remains `http://localhost:3000`. Do not print the token or other tunnel process command lines.

### v5 visual consistency

All four Hero scenes use the same fixed light canvas (`#f0ebf8`), including publishing. The publishing headline and supporting labels use dark text; the standalone lower-page publishing illustration retains its own dark treatment. The video container shares the desktop H1 maximum width through `--hero-content-width`, is centered, and fits the available mobile width.
