# Vizard alternative: editorial and implementation notes

Prepared 2026-09-26 after the user selected Vizard. Local implementation only; no production release. Delivery status lives in the [content plan](../research/2026-09-07-blog-seo-acquisition-summary.md). See the [research brief](../research/2026-09-26-second-alternative.md) for candidate selection and unavailable search-volume metrics.

## Scope and sources

Route: `/alternatives/vizard-alternative`. The article is a direct switching comparison, distinct from the OpusClip multi-tool shortlist. It covers free editing, billing periods, transcript controls, output and project portability. It does not claim lower prices, exclusive text editing, superior quality or measured time savings.

Sources checked on 2026-09-26:

- https://vizard.ai/pricing — Chrome `ai-publisher` live selector verified Creator $29/month at 600 credits/month, or $174/year at 7,200 credits/year. Static extraction incorrectly displayed $0, so it was not used for dynamic prices. Free lists 60 credits/month, editor access, 720p and 3-day storage. Creator lists 4K and scheduling; Business lists shared workspace and brand tools. Annual credit expiration/rollover was not verified and is not asserted.
- https://vizard.ai/tools/text-based-video-editing — Vizard documents deleting transcript text to remove corresponding video content. Scribix boundary selection is explicitly distinguished from that capability.
- [Scribix pricing](../../lib/pricing-v2.ts), [plan allowances](../../lib/plans.ts), [editing contract](../video-workspace/editing-and-framing.md), and [product status](../roadmap/video-product-plan.md) — canonical prices, one-time free allowance, paid editing, source retention, 9:16 output and unavailable internal sentence edits. Local implementation does not establish new production acceptance.

Full competitor URLs remain internal, following the existing public-content rule. Public article lists source names and check date. No competitor account, upload, purchase or comparative render was performed. Scheduling/platform acceptance is not marketed as a Scribix advantage.

## Implementation and media

- `lib/alternatives/vizard.ts`: article metadata, dated comparison rows, FAQs; Scribix facts interpolate canonical pricing configuration.
- `app/[locale]/alternatives/vizard-alternative/page.tsx`: server-rendered article, Article/Breadcrumb JSON-LD, native FAQ, internal links and upload CTA with paid-editing disclosure.
- Registry adds the article to the index, footer and sitemap. Existing middleware normalizes locale prefixes to the English URL. No translated variants or hreflang.
- `app/components/guides/comparison.css` is shared with the OpusClip article; Vizard-specific responsive rules stay alongside its page.
- Existing `ComparisonDemo` remains a labeled illustration. Reuse unchanged `public/media/guides/podcast-tiktok/export.mp4` and its poster. Source: Changeover Podcast; media provenance and existing authorization are documented in [Guide notes](how-to-clip-podcasts-for-tiktok.md). No new source license verification is implied.
- Demonstration scenes do not alter the actual video. Editorial tips are instructions, not fabricated before/after results. Native video uses `preload="none"` and no autoplay.

## Release boundary

The September 26 metadata is the prepared article date. If release occurs later, update the new article's publication date to the actual release day. Preserve September 26 as the factual check date unless sources are rechecked. No D1 migration, Worker binding, new analytics event or deployment is needed for the page itself.

Production availability of the advertised Scribix flow and source facts should be confirmed during release acceptance; this content-only implementation does not constitute a new end-to-end product test.

## Local validation — 2026-09-26

- Final `npm run build` passed, including TypeScript and six-language locale parity. Existing middleware deprecation and missing YouTube-caption-service-token warnings remain unrelated to this content route. A sandboxed retry could not open local listeners; the final build succeeded with approved execution permissions.
- Chrome `ai-publisher`: desktop and 390px mobile layout, light/dark theme, scene selection and FAQ expansion checked. Mobile page has no document-level horizontal overflow; comparison table has its own scroll container. Restored original theme and viewport.
- Native video played to 32.99 seconds of 57.433 seconds without a media error, then was paused.
- Local HTTP checks: new article, directory, existing Opus article and sitemap return 200; single English Vizard sitemap URL; English canonical and no hreflang; all six locale prefixes return 308 preserving query parameters. Corrected quso.ai copy appears in the old article.
- Local preview: http://localhost:3000/alternatives/vizard-alternative . No commit, push or production deployment.
