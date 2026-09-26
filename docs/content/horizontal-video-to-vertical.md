# Horizontal video to vertical: Guide production notes

Prepared 2026-09-26. Local implementation only; no production release. Status is maintained in the [content plan](../research/2026-09-07-blog-seo-acquisition-summary.md).

## Research before localization

The user required research into local search wording before translation. The [six-language handoff](../research/2026-09-26-horizontal-vertical-localization.md) records markets, queries, primary terms, adjacent intents and dated source URLs. It was prepared before article copy.

English, French, Spanish, Italian, Japanese and German share the instructional facts but use local phrasing in titles, descriptions and headings. German uses Querformat/Hochformat; Japanese uses 横動画・縦動画・見切れ; Spanish uses pasar and encuadre with Spain-oriented vídeo spelling. This is qualitative language evidence, not a search-volume ranking or completed native-speaker review. No independent CTA research was performed.

## Implementation

- Shared slug: `/guides/how-to-convert-horizontal-video-to-vertical`, localized using the existing six-language prefix rules.
- `lib/guides/registry.ts` owns route, order, date, thumbnail, section identifiers and media paths. `lib/guides/locales/*.json` contains localized copy and illustration labels only.
- Six sections: crop vs full-frame fit; one speaker; two speakers; screen recordings; Scribix controls; export review. Includes a four-item interactive checklist.
- `FramingDiagram.tsx` renders an original, server-rendered SVG scene through real crop/fit viewports. Fixed inverse media colors preserve the represented scene across themes. Localized text accompanies all three views. No client JavaScript or generated bitmap is added.
- The existing article renderer handles the optional illustration; the directory uses an optional registry thumbnail. Existing tutorials and checklist retain their rendering and metadata paths.
- Current guide infrastructure supplies index cards, self-canonicals, reciprocal language alternates, Article/Breadcrumb data and six sitemap URLs. No new horizontal-to-vertical landing page is created in this change.

## Product and evidence boundaries

The guide explains geometry and editorial decisions, rather than promising full-frame, distortion-free portrait fill. It distinguishes image crop from clip boundaries and rotation. Product instructions follow [editing and framing](../video-workspace/editing-and-framing.md): Auto, Fit, per-section crop/zoom, saving, caption review and paid editing. Free accounts can export original candidates. It does not promise two-person split screens, face-plus-screen layouts, blurred backgrounds, generative expansion or whole-recording conversion.

Reuse unchanged `public/media/guides/podcast-tiktok/framing.jpg`, `export-poster.jpg` and `export.mp4`; no new upload, transcription or rendering job. Source: Changeover Podcast. Existing user authorization and provenance remain in [podcast tutorial notes](how-to-clip-podcasts-for-tiktok.md); no additional source license verification is implied.

The screenshot documents the interface. The existing 57.433-second export retains original letterboxing, captions and audio. Its appearance is not evidence that Fit was selected and does not establish improved automatic tracking. The SVG is explicitly labeled as an illustration; it is not a product export, measurement or before/after test. These distinctions appear in all six articles.

## Release boundary

The prepared publication date is September 26. Update to the actual release date if publishing later. No commit, push, production deployment, schema change or new analytics instrumentation is part of this preparation. Local content validation does not replace live product acceptance or search-indexing verification.

## Local verification — 2026-09-26

- `npm run check-locales` and final `npm run build` pass, including strict TypeScript. Existing missing YouTube-caption-service-token and middleware-convention warnings remain unrelated to this route.
- All six local article URLs and guide directories return 200 with the localized title; self-canonical, seven language alternates (six locales plus x-default), matching Article language and six sitemap URLs verified.
- Chrome `ai-publisher`: English desktop layout and three-view framing illustration, 390px Japanese article/illustration, German long paragraphs and loaded framing screenshot inspected. French, Spanish, Italian, German and Japanese mobile document widths checked without horizontal overflow.
- Language picker tested from English to Japanese and back from German to English. In-page section navigation, an interactive checklist item and dark-theme illustration checked. Original theme and viewport restored.
- Existing export playback checked in the guide; source media is shared unchanged with the previous tutorial.
- No production publishing or search-indexing verification.
