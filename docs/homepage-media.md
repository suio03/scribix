# Homepage media and feature demonstrations

## Components and behavior

- `app/components/VideoHomeHero.tsx` shows `VideoHomeDemo` to signed-out visitors. The 15-second Hero uses an existing Scribix project's source and exported clips.
- `app/components/VideoHomeShowcase.tsx` owns the source-format gallery, lesson selection, framing comparison, caption styles, video-only interview card, workflow illustrations and source credits.
- `app/components/VideoHomeMarketing.tsx` assembles these sections with audiences, FAQ and the final upload CTA.
- `useHomeVideoLoop.ts` plays muted, looping, inline video with no native controls. It pauses outside the viewport, in a hidden tab, or under reduced motion, and resumes when eligible. Posters remain available if autoplay is blocked.
- The interview card is video-only: do not restore Reset, start/end sliders, duration readouts or interactive-preview instructions. Lesson selection and caption-style buttons remain interactive.
- Homepage copy lives in `VideoHome.demo` and `VideoHome.showcase` in all six message files. Keep asset IDs, URLs, timing and source data in code.

## Proof versus illustration

The Hero contains real project output. The new source-format gallery and feature demonstrations use licensed source excerpts prepared for the homepage; they are not completed Scribix project exports or customer endorsements. Keep this distinction in copy. Do not introduce invented AI scores or output counts.

Caption cues use the supplied Ellen Gertsen SRT, shifted by 30.07 seconds. They are phrase-level cues, not word-level timing. Clean/Focus styles render as HTML over the video and are not baked into its MP4.

## Assets

`public/media/home-demo/` contains the Hero MP4 and poster. `public/media/home-variety/` contains the current lower-page media. These delivery MP4s are short, silent H.264 loops with fast-start metadata; the full source recordings must not be bundled into the website.

| Asset stem | Source | Source start | Duration | Display |
| --- | --- | --- | --- | --- |
| interview | ConversationEDU, Interview with Steve Wozniak | 00:30 | 10 seconds | 960 × 540; preserves camera cuts and both speakers |
| lecture | Ellen Gertsen, Introduction | 09:04 | 10 seconds | 960 × 540; full slides |
| captions | Ellen Gertsen, Introduction | 00:30.07 | 10 seconds | 540 × 960; source crop 608 × 1080 at x=730 |
| robotics | ZDF, Was macht ein Roboterforscher? | 01:41 | 10 seconds | 960 × 540 |
| robotics-portrait | Same robotics excerpt | 01:41 | 10 seconds | 540 × 960; source crop 608 × 1080 at x=660 |
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

Check desktop/mobile layouts, both themes, poster loading, silent looping without controls, lesson selection, caption style/cue changes and source credits. Preserve reduced-motion behavior. Full source masters and the editable Hero composition are local production inputs, not repository dependencies.
