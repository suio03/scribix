# OpusClip alternatives: editorial and visual sources

Prepared 2026-09-20. Delivery status lives in the [content plan](../research/2026-09-07-blog-seo-acquisition-summary.md). Public route: `/alternatives/opus-clip-alternative`.

## Scope

The user selected an English-only feature/workflow comparison with polished product illustrations. A new recorded product run or competitor benchmark is not required. Do not turn these visuals into claims of superior accuracy, speed, engagement or automatic framing quality.

Implementation: `app/[locale]/alternatives/opus-clip-alternative/`, `lib/alternatives/opus-clip.ts`, and `app/components/guides/ComparisonDemo.tsx`. The interactive visual is rendered in HTML/CSS with existing media, not a screenshot of the full application. Three buttons select candidate review, boundary/framing controls, and caption styling. The real output remains a separate native video player.

## Fact sources

The user confirmed on 2026-09-20 that comparison pages must not link to competitor websites. Public content retains source names and verification dates as plain text; source URLs stay in this internal record for future checks. Scribix internal links remain available.

All competitor sources were checked on 2026-09-20:

- [OpusClip pricing](https://www.opus.pro/pricing): Free 60 credits/month, watermark, no editing, three-day export window; Starter $15/month; Pro $29/month with B-roll, multiple aspect ratios, scheduling, Premiere Pro / DaVinci Resolve handoff. Use monthly prices in the table, not annual equivalent prices.
- [Vizard pricing](https://vizard.ai/pricing): Free 60 credits/month, editor access, 720p and three-day storage; Creator adds watermark removal, 4K and scheduling; Business adds shared workspace and brand kit. Initial extracted page showed `$0` placeholders; Chrome ai-publisher live monthly selector resolved Creator to $29/month at 600 credits/month and Business to $39/month. Do not use placeholder values as prices.
- [quso.ai pricing](https://quso.ai/pricing): Free 75 credits/month, 720p, TikTok publishing and seven-day retention; Lite $29/month, desktop editor, three aspect ratios and six-platform scheduling; Content Planner on Essential, brand tools and analytics on Growth. Annual offers have different credit allowances.
- Scribix: `lib/plans.ts` supplies free lifetime source-processing minutes and Pro monthly pricing; `lib/video-workspace/access.ts` requires a paid plan for clip editing/brand controls. `lib/video-workspace/contracts.ts` and the [clip workflow](../video-workspace/clip-workflow.md) define portrait output and review controls. [Scribix pricing](https://scribix.io/pricing) is the user-facing plan link. No claim of free editing, unlimited exports, professional-editor handoff or URL-based video clipping is made.

The article is authored by Scribix, with the relationship disclosed. Vendor plan facts are not an independent quality evaluation. Recommendations are editorial interpretations of workflow fit. Recheck affected claims against these sources when updating the article.

## Reused Guide materials

Source and attribution are inherited from [tutorial production notes](how-to-clip-podcasts-for-tiktok.md): Changeover Podcast, the existing user-provided recording. The user's 2026-09-20 instruction explicitly chooses existing Guide resources for this comparison. This does not establish an open source-video license or an endorsement.

- `public/media/guides/podcast-tiktok/export-poster.jpg`: unchanged portrait frame in the composed demonstration; preserve full aspect ratio and letterboxing.
- `public/media/guides/podcast-tiktok/export.mp4`: unchanged 57.433-second export, with source audio and burned-in captions; `preload="none"`, native controls, no autoplay.
- Existing candidate capture: titles and approximate source ranges used for the selection illustration. Start/end controls use the existing first candidate range `00:01.663–00:59.087`.
- Caption phrase “MAKE THE WORDS COUNT” and waveform are illustrative, not reconstructed speech or measured audio. The figure caption identifies this. Do not imply the example phrase appears in the actual export or that switching the demonstration scene changes its video.

No new image or video payload is added. The composition stays responsive and uses semantic theme colors; media and caption samples use fixed preview colors. Scene transitions respect reduced-motion preferences.

## Language and routing contract

Locale-prefixed Alternatives URLs, including the directory, return 308 to the unprefixed English URL and retain query parameters. This permanent normalization applies only to Alternatives; existing legal and partner locale redirects retain 307.

The user selected the keyword-aligned slug `opus-clip-alternative`. Its canonical path is defined in `lib/alternatives/routes.ts`. The previous `/alternatives/opus-clip` URL (including locale-prefixed versions) permanently redirects to the new URL with query parameters preserved. Directory and footer links, metadata and sitemap use the canonical path.

All `/alternatives` routes use the existing middleware's English-only rewrite/redirect behavior. The article also redirects non-English locale params defensively. Metadata has an English self-canonical and no language alternates. The independent `/alternatives` directory lists this article; it is removed from the Guides cards and collection schema. The full public footer has a separate Alternatives group on all locales, using unprefixed English links. Directory and article are English-only, with no language switcher; the article header, back link and breadcrumb lead to Alternatives. The registry in `lib/alternatives/registry.ts` supplies implemented entries to the directory, footer and sitemap. Sitemap includes one unprefixed directory URL and one URL per article. `ContentShell` hides the language selector through an explicit prop, preserving the selector on other Guides.

## Validation notes

Next production build and locale parity pass. Chrome checks include scene switching with pointer and keyboard, FAQ expansion, desktop and 390px layouts, light/dark demonstration appearance, loaded poster and video playback advancing past 13 seconds (57.433-second duration, no media error). HTTP checks on a fresh `next start --hostname localhost --port 3100` verify all six prefixed redirects, French preference handling, no HTML/HTTP hreflang, canonical, exactly one comparison sitemap entry and English-only index card.

Use `localhost` for local preview. The existing dev asset prefix does not hydrate reliably through `127.0.0.1` in this session. A production preview bound to `127.0.0.1` also exposed an absolute-rewrite host mismatch affecting existing legal pages; binding the temporary preview to `localhost` resolved it without changing shared host logic. This is local verification, not Cloudflare deployment verification.

Navigation separation check (2026-09-20): Guides remains tutorials/checklists; Alternatives owns comparison navigation. No placeholder Vizard or Quso links are created before those pages exist.

## 2026-09-26 published maintenance

Rechecked https://quso.ai/pricing: Lite lists TikTok publishing; Essential adds scheduling to seven platforms. Corrected the output and detail copy; published in `4172cc7` and verified on production. Preserve the September 20 publication date, with September 26 modification metadata and a scoped source note. Shared comparison CSS now lives in `app/components/guides/comparison.css` for both articles.
