# Long video to short video AI landing page

Created: 2026-09-23. Verified: 2026-09-24.

## Scope and implementation

- English: `/long-video-to-short-video-ai`; French, Spanish, Italian, German and Japanese versions added on 2026-09-24 under the existing locale prefixes.
- Source of truth for copy: `LongVideoLanding` in `messages/*.json`; shared rendering in `app/[locale]/long-video-to-short-video-ai/page.tsx`.
- Branch: `feat/long-video-to-short-video-landing`.
- Upload CTA opens the existing login modal for anonymous visitors, with the current locale’s `/dashboard/new` as the post-login destination. Signed-in visitors link directly to that existing video uploader.
- Each language has its own canonical, reciprocal hreflang, footer link and sitemap entry. The shared language switcher stays on this landing page.
- The user requested a new generated demo image instead of reusing existing real video proof. The page labels it as an AI-generated demonstration with a fictional speaker and example captions.

## Copy

### Metadata

Title: Long Video to Short Video AI | Scribix

Description: Turn long videos into short clips with AI. Find moments in podcasts, interviews, and webinars, then review, refine, and export captioned vertical clips with Scribix.

### Hero

Eyebrow: Long video to short video AI

H1: Turn long videos into short clips with AI.

Turn your podcasts, interviews, and webinars into short clips. Review AI-selected moments, refine captions and vertical framing, and export the clips you want to share.

Primary CTA: Upload your video

Secondary CTA: See an example

CTA note: 60 free lifetime processing minutes. Sign up to start.

Image label: One source. A new format.

Caption: AI-generated demonstration with a fictional speaker and example captions.

Benefits: AI-selected moments / Captions you can refine / Vertical video framing / You choose what to share

### How to turn a long video into short clips.

A simple workflow with room for your judgment at every step.

1. **Upload your video.** Start with a podcast, interview, webinar, or lesson saved on your device.
2. **Review the suggested clips.** Explore AI-selected moments and check each suggestion against the original conversation.
3. **Refine your clips.** On a paid plan, adjust the cut, correct captions, and fine-tune the vertical framing.
4. **Export and share.** Render your chosen clip and download the video, ready to share on your channels.

### Choose the moment. Shape the final clip.

AI gives you a starting point. You decide whether the clip tells the story you intended.

- **Find a complete thought.** Look for a moment that makes sense on its own. Review the transcript and source context before you choose what to share.
- **Keep control of the cut.** Adjust the start and end of a clip around the words that matter. Keep the setup and the point together.
- **Make it work vertically.** Check the portrait crop, keep the speaker in frame, and refine captions so viewers can follow the conversation.

Clip editing is available on paid plans. Compare plans.

### Make more from the videos you already have.

- **Podcasts & interviews — A conversation worth sharing.** Bring a clear opinion, a memorable story, or a useful answer out of a longer conversation.
- **Webinars & presentations — Let the useful part travel.** Give a practical explanation or takeaway its own clip. Check that any essential visual context still fits the frame.
- **Lessons & talking-head videos — One idea at a time.** Turn a focused explanation into a short learning moment, with enough context for someone seeing you for the first time.

### Before you upload

Six FAQs cover hour-long sources, suitable recording types, editing permissions, variable candidate counts, unsupported YouTube source URL import, and free use. Answers are maintained in the page source.

Free accounts include 60 lifetime processing minutes and a 2 GiB video upload limit. Only remaining processing minutes can be used. Free users can export original suggestions; editing requires a paid plan. Source retention is 7 days on Free and 30 days on paid plans. All numeric facts are interpolated from `lib/plans.ts` in the page, rather than maintained as separate application constants.

### Final CTA

Turn your next long video into short clips.

Upload your video

Review the moments. Make them yours. Share when you’re ready.

## Evidence and boundaries

- Search intent and AI citations: [research](research/2026-09-23-long-video-to-short-video-ai/character-survey.md), [source inventory](research/2026-09-23-long-video-to-short-video-ai/sources.md), [reference audit](research/2026-09-23-long-video-to-short-video-ai/reference-audit.md).
- Product scope: [video product plan](roadmap/video-product-plan.md), [editing and framing](video-workspace/editing-and-framing.md), [data and retention](video-workspace/data-and-selection.md).
- Canonical limits: `lib/plans.ts`; editing entitlement: `lib/video-workspace/access.ts`.
- No fixed clip count, virality, speed, accuracy, customer endorsement, or live-render claim is made by the demonstration.
- YouTube caption import is distinguished from importing the source video for clipping.

## Image asset

- Method: built-in `image_gen`, one new generated image.
- Original English asset: `public/media/long-video-to-short-video-ai/podcast-demo.webp` (retained).
- Current shared asset: `public/media/long-video-to-short-video-ai/podcast-demo-localized.webp` (88,516 bytes, 1536 × 1024, WebP quality 86). The baked English captions were removed with ImageGen; localized HTML captions are rendered over the portrait panel.
- Original output remains in the image generation directory; the project uses its own optimized copy.
- Prompt:

```text
Use case: ads-marketing.
Asset type: a premium SaaS landing page demonstration image for Scribix, showing long landscape video becoming a captioned vertical short. Generate one polished wide 1536x1024 raster illustration.
Scene: a cinematic educational podcast recording with a fictional woman in her early 30s, dark wavy shoulder-length hair, warm terracotta overshirt, talking naturally into a charcoal studio microphone. Tasteful warm studio with soft daylight, beige walls, subtle bookshelf and a leafy plant, realistic editorial photography.
Composition: a pale lavender studio canvas. On the left a large straight-on landscape 16:9 video panel showing the speaker seated at a desk with generous surrounding environment. On the right a tall straight-on 9:16 portrait video panel showing the EXACT same woman, same pose and same moment, tightly reframed on her face and upper body. Left panel is about 55% of canvas width; right panel 25%, leaving breathing space around each. Elegant rounded corners and subtle shadows. A thin violet connector flows from left panel to right panel, a small violet sparkle at its center. Below the landscape panel, a quiet schematic timeline with lavender segments and one yellow selected moment. No playback buttons. No outer browser chrome. No page headline. No stats, scores, duration numbers, brands, platform logos, badges, or fake testimonials.
The portrait panel has crisp, beautifully legible white bold sentence-case captions over a dark translucent backing near the lower third, reading verbatim: "One idea. A new perspective." The words "One idea." have a warm pale yellow highlight with dark lettering. The landscape panel has no captions. Only those exact caption words appear in the entire image.
Style: refined photo and product illustration hybrid, realistic photographic faces and materials, meticulous typography, gentle depth, visually calm. Colors align with violet #7552e8, warm pale yellow, lavender #f0ebf8, charcoal. Fictional demo, no recognizable public figures. Keep every panel fully within the image, enough outer margin for responsive presentation.
```

## Initial English validation (before localization)

Historical results below describe the first English-only version. Current locale behavior is recorded in the localization validation section that follows.

- `npm run build` passed, including TypeScript and the six-language dictionary precheck.
- `git diff --check` passed.
- Chrome ai-publisher: desktop dark and mobile light layouts; no horizontal overflow; generated asset loaded; one H1; correct title/canonical; no hreflang to missing translations.
- Production preview: anonymous upload CTA opens the existing login dialog; example anchor scrolls to the illustration; free-use FAQ expands.
- HTTP checks: locale-prefixed route redirects to English; Japanese Accept-Language still receives English; sitemap contains one English URL.
- The existing port 3000 development page rendered visually but its client button did not respond. Interactions passed on the isolated production preview at port 3001. No OAuth submission or actual video upload was performed.
- Existing build warnings: deprecated middleware convention and missing `YOUTUBE_CAPTION_SERVICE_TOKEN`; neither prevented the build.
- Not committed, pushed, or deployed.

## Localization validation (2026-09-24)

- French, Spanish, Italian, German, and Japanese copy is implemented from the [local search-expression research](research/2026-09-24-long-video-keyword-localization.md), which links each full copy snapshot and records the shared image edit prompt.
- `npm run check-locales` and `npm run build` passed, including TypeScript validation.
- All six locale URLs return HTTP 200 with localized titles, matching canonical URLs, and complete language alternates; the sitemap contains all six landing URLs. Localized pages now render in their own language instead of redirecting to English.
- Browser checks covered desktop/mobile layouts, all five new locales for mobile text overflow, language switching, the French login CTA, the German free-use FAQ, and localized demo captions. Japanese heading wrapping was corrected.
- No OAuth submission, actual upload, commit, push, or deployment was performed. Search-volume validation and native-speaker review were outside this localization pass.
