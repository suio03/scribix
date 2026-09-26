# YouTube Shorts Maker — multilingual release preparation

Prepared 2026-09-27. Initially English only with a fresh clip demo. After English review, the user requested localization through `lyl-keyword-localizer`; French, Spanish, Italian, German and Japanese are now implemented. The user subsequently authorized pre-launch fixes: indexing eligibility, sitemap discovery, internal links and metadata are now prepared in code. No deployment or commit was performed.

## Intent and copy

Research: [competitor page audit](research/2026-09-27-youtube-shorts-maker-competitors.md). The subsequent user-approved direction is three distinct pages: Shorts maker (including YouTube to Shorts), YouTube clip maker, and YouTube to TikTok. This change implements only the first. It does not present one page as owning all four keyword intents.

Page paths: `/youtube-shorts-maker` (English) and `/{fr,es,it,de,ja}/youtube-shorts-maker`. Standard locale routing, the language picker and six-language/x-default alternates are enabled; each locale has its own canonical. The review-only `noindex` has been removed. The sitemap emits all six URLs with language alternates and a 2026-09-27 modification date. Localized links from Footer and the long-video page provide inbound discovery. These are code changes, not evidence of a production deployment or search-engine indexing.

Title: YouTube Shorts Maker — Turn Your Videos into Shorts | Scribix.

H1: the visible “YouTube Shorts maker” eyebrow and “Your long video. Your next Short.” headline now form one H1. Other locales use their natural category phrase; Japanese uses “YouTubeショート作成ツール”.

Lead: You already recorded something worth sharing. Turn it into YouTube Shorts with AI-selected moments, readable captions and a frame made for the feed.

Open Graph/Twitter use shared `socialImages` (1200×630, descriptive metadata) with `siteName: Scribix`. A localized WebPage JSON-LD identifies the page. Locale static params remain owned by the parent layout.

Runtime copy is in `messages/*.json` under `YouTubeShortsLanding`. Stable section keys, icons, media paths and route structure stay in `app/[locale]/youtube-shorts-maker/page.tsx`. English copy is retained; other languages are adapted using the [local keyword evidence](research/2026-09-27-youtube-shorts-keyword-localization.md). Readable localized copy is saved in `docs/landing-page-{fr,es,it,de,ja}-youtube-shorts-maker.md`. Sections: source/portrait demonstration, three-step workflow, paid editing controls, Shorts review checklist, seven practical FAQs, final CTA and related existing pages. The primary CTA reuses the real login-to-new-project component.

Claims follow `lib/plans.ts`, `docs/video-workspace/editing-and-framing.md` and `docs/roadmap/video-product-plan.md`: one-time free processing allowance, original candidate exports, paid editing, local file input, possibly zero candidates. No URL video import, fixed clip count, guaranteed views, processing-time claim, or automatic YouTube publishing promise. The page does not invent platform duration limits or expose unverified production capabilities.

## Entirely new demo

- Final source: [Woman Doing Podcast, Pexels 4540152](https://www.pexels.com/video/woman-doing-podcast-4540152/), credited by Pexels to [Kaboompics / karola-g](https://www.pexels.com/@karola-g/).
- Download URL observed on the official page: `https://videos.pexels.com/video-files/4540152/4540152-hd_1920_1080_30fps.mp4`.
- [Pexels license](https://www.pexels.com/license/) checked 2026-09-27: permits use and modification; no implied endorsement. Attribution and demonstration limits appear beside the demo.
- Source 2–14 seconds, delivered as a 960×540 landscape excerpt and a 540×960 portrait crop (608×1080, x=580, y=0), both 12 seconds at 24 fps, H.264/yuv420p with fast-start, no audio. Full source stays in ignored `.artifacts/shorts-maker/source-4540152.mp4`.
- Four newly composed sample captions are burned into each portrait video. The five localized variants use the same new source and crop, with localized captions and posters; they do not reuse earlier site demos. They are illustrative text, not the speaker’s words. The page does not label this as a Scribix export or evidence of AI selection/automatic tracking.
- Public delivery: `public/media/youtube-shorts-maker/{source-studio,short-studio}.{mp4,jpg}` plus `short-studio-{fr,es,it,de,ja}.{mp4,jpg}`. Only the current locale’s variant is loaded. The hero and comparison videos autoplay silently and loop while at least 30% visible. They pause offscreen or in a hidden tab. Native play/pause/seek controls remain available; reduced-motion users start playback manually. This follows the owner’s autoplay feedback.
- Reproduce: `node scripts/youtube-shorts-maker/render.mjs .artifacts/shorts-maker/source-4540152.mp4`. Append `fr`, `es`, `it`, `de` or `ja` to render a localized variant. Requires existing Sharp and FFmpeg; Japanese overlay rendering uses macOS Hiragino Sans. Raster overlays are rendered from original SVG typography.
- No homepage, older landing-page or Guide clip is reused. First candidate Pexels 4912138 was rejected after frame inspection because the camera moves away from the speaker; its trial exports were removed from public delivery.

## Validation

- Production build and six-language parity validation passed; existing middleware-deprecation and missing YouTube caption token warnings are unrelated to this page.
- Chrome ai-publisher: dark desktop and 390px mobile inspected, no horizontal overflow; demo anchor, portrait video playback, free-plan FAQ and upload-triggered English login modal verified. No login or upload was submitted.
- Browser metadata: locale-specific canonical, six-language plus x-default hreflang entries, no `noindex` after release preparation.
- All seven MP4s decode completely with FFmpeg. The five localized portrait variants are approximately 802–806 KiB each. A 20-frame caption contact sheet verifies accents, Japanese glyphs and line fit across all four caption states.
- Localization validation: all five localized routes inspected at 390px; Japanese and longer Latin-script headings adjusted to avoid awkward mobile wrapping. Desktop French/Japanese and English regression inspected. Language-menu navigation preserves the Shorts route. German free FAQ resolves the canonical 60-minute / 2 GiB facts and the upload action opens the German login modal. No sign-in or upload submitted.
- Hero autoplay and offscreen pause verified in the browser; localized source paths and posters resolve. No browser console errors observed.
- Final production build, TypeScript, six-language parity/ICU validation and `git diff --check` passed after the layout fixes.
- Existing user-owned port 3000 server reused. No new deployment, remote migration or social publishing operation.

## Pre-launch verification — 2026-09-27

Six-language rendered HTML and sitemap checks cover robots, a single H1 containing the local category, self-canonical, seven hreflang entries, shared OG dimensions/alt/site name, localized WebPage JSON-LD and two inbound links from the long-video page (body and Footer). The long-video sitemap modification date now reflects the new links. `CLAUDE.md` lists nine core routes. All checks passed, along with the production build, locale parity and `git diff --check`. Chrome desktop and 390px English/Japanese screenshots confirm the H1 grouping preserves the visual hierarchy; the new long-video body link was clicked through to the Shorts page. No deployment is implied.
