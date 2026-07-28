# Changelog

## [0.23.3] - 2026-07-28

### Added
- Added a Startup Fame badge to the homepage partner section.

### Changed
- Moved usage details into the account menu for a more compact sidebar.

## [0.23.2] - 2026-07-27

### Changed
- Rewrote the Video, Audio, MP3, YouTube, and AI Note Taker metadata around distinct search intent and localized the new titles and descriptions across all six supported languages.

### Fixed
- Prevented the MP3 and YouTube landing-page titles from appending the Scribix brand twice through inherited metadata templates.

## [0.23.1] - 2026-07-26

### Changed
- Restricted partner badges to localized homepages and reduced their displayed size.

## [0.23.0] - 2026-07-26

### Changed
- Refreshed the homepage, converter landing pages, application chrome, pricing, legal, billing, and transcript surfaces with a unified neutral visual system, responsive behavior, and dark-mode styling.
- Simplified the homepage, audio, MP3, YouTube, and AI Note Taker hero headings to one localized H1 without a forced accent line.
- Standardized sidebar, upload, modal, popover, transcript, export, and marketing presentation across public and signed-in experiences.

### Fixed
- Improved the single-plan pricing composition and mobile layouts for landing, upload, and transcript surfaces.

## [0.22.0] - 2026-07-25

### Added
- Added browser-specific Chrome, Microsoft Edge, and Firefox extension builds, store-ready ZIP packaging, and a reproducible Firefox source archive.
- Added PKCE-based extension authorization with short-lived access tokens, rotating revocable refresh tokens, dedicated auth endpoints, and D1 migration `0021`.
- Added extension sign-out controls and browser-store publishing, privacy-disclosure, testing, and reviewer guidance.

### Changed
- Updated extension account and AI summary requests to use bearer-token authentication while retaining a narrowly scoped compatibility path for published Chrome 0.1.2 installations.
- Restricted credentialed legacy CORS and authorization redirects to published browser identities, including the configured Microsoft Edge extension ID.
- Updated the extension privacy page, project architecture notes, and release runbooks for Chrome, Edge, Firefox, and the current Free partial-transcript behavior.

### Fixed
- Generated a Firefox-compatible background script declaration and Gecko manifest metadata while preserving the shared extension source.
- Removed obsolete login polling and completion code in favor of the browser identity callback flow.
- Prevented production deployment when the Microsoft Edge extension ID is missing or malformed.

### Removed
- Removed the obsolete Chrome-only login completion script.

## [0.21.0] - 2026-07-25

### Added
- Added explicit Free partial-transcript choices for files longer than the remaining lifetime allowance, using the user's real available minutes.
- Added persistent partial-transcript labels across transcript results, playback, and exports, plus offer, confirmation, start, upgrade, and size-cap analytics.
- Added source-duration, processing-boundary, and explicit partial-consent fields through D1 migration `0020`.

### Changed
- Allowed Free users to upload long audio and video files while processing only the explicitly confirmed range, including browser-unsupported media-duration fallbacks.
- Updated pricing, upload guidance, FAQs, and partial-transcript UI across all six locales to distinguish the Free lifetime allowance from per-file length.
- Updated deployment and post-release documentation for locale validation and the latest shipped baselines.

### Fixed
- Kept quota reservation and settlement within the actual processed range while supporting both observed and documented AssemblyAI duration semantics.
- Preserved legacy paid and recording quota behavior while preventing unconfirmed Free upload truncation and stale concurrent quota confirmations.
- Kept SRT and CSV exports format-compatible while adding partial notices to TXT, DOCX, VTT, and the export panel.
- Enforced Free restrictions for AI Notes and translation reads as well as writes.
- Rejected recordings without an authoritative duration and excluded paused time from recorded duration calculations.

## [0.20.1] - 2026-07-25

### Added
- Added locale validation for key, type, array-length, ICU-placeholder, and structural-field parity across all six languages.
- Enforced locale validation before Next.js builds, OpenNext previews, and production deploys.

### Changed
- Moved navigation, icon, route, ordering, landing-page layout, and pricing structure out of translation JSON and into typed TypeScript backed by canonical plan configuration.
- Reordered and unified site and dashboard sidebar navigation while preserving one source of truth for external-link icons and behavior.
- Updated localized product copy and operational guidance for current quotas, Pro-only new purchases, and grandfathered Starter support.

### Fixed
- Prevented translated content arrays from silently drifting from their TypeScript definitions or rendering empty cards.
- Corrected stale sidebar quota fallbacks, upload-limit guidance, and inconsistent localized feature-list lengths.

### Removed
- Removed unused comparison and testimonial components plus obsolete structural and dead translation fields.

## [0.20.0] - 2026-07-25

### Added
- Added an annual-first monthly/yearly selector to the localized Pro upgrade modal, with the $120 yearly total, $10 monthly equivalent, and 50% savings shown together.
- Added monthly allowance windows for yearly Pro subscriptions so 2,400 transcription minutes and YouTube import credits reset each month without rollover.

### Changed
- Simplified new purchases to Free and Pro, priced at $20 monthly or $120 yearly, while preserving existing Starter subscriptions as a legacy plan.
- Updated production Paddle Pro Price IDs, localized pricing and billing copy, account usage, Terms, launch checks, and structured offer metadata for the new model.
- Refreshed AI Notes setup, project guidance, and post-release monitoring documentation.

### Fixed
- Prevented delayed transcription completion or failure reconciliation from changing a newer monthly allowance window.
- Added the Scribix project identifier to successful checkout Discord alerts.

### Removed
- Removed Starter from new upgrade and purchase surfaces, along with the obsolete plan-comparison action in the single-plan upgrade modal.

## [0.19.0] - 2026-07-23

### Added
- Added a localized AI note-taker landing page with metadata, structured data, sitemap coverage, conversion tracking, and tailored copy across all six supported locales.
- Added the AI Note Taker to localized site navigation.

### Changed
- Made shared marketing sections reusable with page-specific translation namespaces, icon mappings, and upload attribution.
- Unified the transcript summary experience under the AI Notes name across supported locales.
- Carried plan limits, billing cycles, and landing-page attribution through YouTube imports.

## [0.18.2] - 2026-07-23

### Added
- Added a There's An AI For That partner badge beside the existing Dang.ai homepage badge.

## [0.18.1] - 2026-07-22

### Changed
- Unified Starter file and YouTube duration limits at 10 hours and updated the localized pricing and upload guidance.
- Split Discord delivery across dedicated error, checkout, and feedback webhooks while keeping account deletion and successful maintenance summaries in structured logs.
- Refreshed upload analytics and post-release operational documentation to match the shipped lifecycle events and monitoring workflow.

### Fixed
- Replaced AssemblyAI's deprecated paid speech model with `universal-3-5-pro` while retaining `universal-2` fallback.
- Prevented transcription failures, billing events, and feedback from being mixed into the same Discord channel.

### Removed
- Removed the unsupported homepage trust-stat strip and its localized copy.

## [0.18.0] - 2026-07-22

### Added
- Added authenticated upload preflight, tier-aware limit guidance, upgrade conversion events, and detailed direct-video lifecycle telemetry.
- Added real browser recording with pause, resume, preview, discard, permission handling, and upload support.
- Added durable Paddle transaction and adjustment ownership records without duplicating monetary data from Paddle.
- Added post-release reliability monitoring, Bing tracking support, and a documented growth and conversion repair plan.

### Changed
- Made Paddle the sole financial source of truth while keeping checkout completion, plan, cycle, and transaction attribution in Scribix and Plausible.
- Improved localized metadata, sitemap stability, robots rules, landing-page authentication return paths, and core English and translated product copy.
- Replaced unsupported marketing proof, security claims, customer logos, and benchmark language with verifiable product facts.

### Fixed
- Prevented ambiguous AssemblyAI submissions and stale cleanup from permanently consuming transcription quota, including recovery by webhook token when the upstream ID response is lost.
- Improved multipart upload retry, offline recovery, polling recovery, refresh continuation, and safe submit retry behavior without duplicate uploads or transcription jobs.
- Prevented missing Paddle totals from blocking plan activation and recovered historical or out-of-order adjustment ownership without silently discarding Scribix events.
- Removed redirected localized legal URLs from sitemap hreflang output and aligned canonical legal entries with middleware behavior.
- Restored functional homepage recording, YouTube OAuth URL recovery, and authentication before file selection on public upload tools.

### Removed
- Removed client-side revenue amounts, local monetary ledger columns, the internal revenue endpoint, and unused checkout payment breakdowns.
- Removed the obsolete logo exploration asset and unsupported testimonial/comparison content.

## [0.17.0] - 2026-07-19

### Added
- Added hybrid video ingestion with browser audio extraction for smaller files and 100 MiB R2 multipart uploads for original videos up to the plan limit.
- Added authenticated multipart part signing, server-side ListParts validation, idempotent completion checks, upload analytics, and stable audio/video transcript playback.
- Added a documented hybrid upload rollout plan and structured cleanup logging for expired or failed media deletion.

### Changed
- Increased video upload limits to 2 GB for Free and a safe 5 GB product limit for Starter and Pro while retaining the 1 GB audio limit.
- Extended source-media retention to 14 days and pending upload retention to 24 hours, with R2 deletion required before database references are cleared.
- Updated the YouTube extension to 0.1.2 so its content script can follow YouTube SPA navigation while mounting only on supported watch pages.
- Refreshed project guidance, localized product copy, privacy/terms copy, and Cloudflare operational documentation for the current billing, upload, and retention behavior.

### Fixed
- Preserved valid audio uploads with missing browser MIME metadata by explicitly setting upload Content-Type and sharing the supported audio-container rules between client and server.
- Prevented transient multipart completion failures from discarding completed large uploads by retrying safely and confirming the final R2 object before cleanup.
- Prevented media deletion failures from hiding or removing transcript records before R2 cleanup succeeds.
- Added localized unsupported-media and playback-error messages across all supported locales.

### Removed
- Removed superseded landing-page planning documents that no longer represent the current implementation source of truth.

## [0.16.1] - 2026-07-17

### Changed
- Added project metadata to Paddle checkouts and isolated webhook processing by project ownership with legacy Price ID fallback.

### Fixed
- Stopped foreign Paddle events from triggering retries or mutating Scribix billing state.
- Deduplicated webhook failure alerts while preserving retries for owned events with missing price configuration.
- Prevented non-active subscription updates from restoring canceled or paused access.
- Kept cancellation, pause, and past-due handling available when a historical Price ID is no longer configured.

## [0.16.0] - 2026-06-22

### Added
- Added the localized YouTube to Transcript landing page with metadata, JSON-LD, sitemap coverage, and sidebar navigation.
- Added YouTube landing page copy across English, French, Spanish, Italian, Japanese, and German.
- Added automatic retry handling for transient YouTube caption service failures.

### Changed
- Shared localized alternate URL generation across landing pages and sitemap entries.

### Fixed
- Show a clearer YouTube unavailable message when the caption service cannot access a restricted, private, region-limited, or otherwise unavailable video.

## [0.15.3] - 2026-06-21

### Changed
- Updated the Chrome extension to version 0.1.1 with automatic return to the original YouTube tab after sign-in.
- Changed the extension header to show the signed-in account avatar instead of the internal plan tier.

### Fixed
- Fixed duplicate extension sign-in refreshes by funneling login completion through a single guarded path.
- Stopped abandoned extension login attempts from continuing account polling after the login tab is closed.

## [0.15.2] - 2026-06-21

### Fixed
- Fixed Chrome extension login by routing users through a dedicated Scribix extension sign-in page.
- Updated the extension login fallback URL to avoid opening the raw Auth.js Google provider endpoint.

## [0.15.1] - 2026-06-21

### Added
- Added a YouTube Extension sidebar entry for signed-out and signed-in users.
- Added a monochrome YouTube extension icon asset for the sidebar entry.

### Changed
- Renamed localized sidebar extension labels to YouTube Extension.

## [0.15.0] - 2026-06-20

### Added
- Added the YouTube transcript Chrome extension package, build scripts, and extension API routes.
- Added daily free YouTube import quota support and extension abuse/cache migrations.

### Changed
- Changed free YouTube caption imports to reset daily at 10 imports per day.
- Refreshed Scribix logo assets and generated extension-ready icon variants.

### Fixed
- Fixed production deploy builds so Paddle public configuration comes from `wrangler.jsonc` production vars instead of local sandbox env files.
- Reserved and refunded YouTube import quota around import attempts so duration failures do not consume quota.

### Removed
- Removed the old logo showcase artifact.

## [0.14.1] - 2026-06-18

### Added
- Added YouTube inspect/import attempt and failure tracking for stability monitoring.

### Fixed
- Bucketed YouTube analytics error codes to avoid high-cardinality browser error messages.
- Classified Scribix app-side YouTube failures separately from caption service failures.

## [0.14.0] - 2026-06-18

### Added
- Added transcript renaming from the dashboard row action menu for uploaded, recorded, and YouTube transcripts.

### Changed
- Extended the transcript PATCH endpoint to update titles with ownership checks and title sanitization.

## [0.13.0] - 2026-06-18

### Added
- Restored YouTube caption imports with URL inspection, caption track selection, dashboard/home entry points, and completed transcript creation through the dedicated caption service.
- Restored YouTube transcript viewing with embedded playback, timestamp seeking, grouped caption display, sidebar quota usage, and pricing/account usage copy.
- Added YouTube caption service configuration for local and Cloudflare environments.

### Changed
- Store and render canonical YouTube watch URLs derived from the returned video ID instead of trusting raw submitted URLs.
- Reset YouTube import usage alongside subscription period changes in Paddle webhook handling.

### Fixed
- Guarded the YouTube import endpoint with quota pre-checks and per-user rate limiting before external caption fetches.
- Clean up written transcript JSON from R2 if a YouTube transcript import fails after object creation.

## [0.12.3] - 2026-06-13

### Changed
- Removed YouTube caption import entry points, viewer embed handling, quota usage, pricing copy, and related metadata reads after YouTube blocked the supported fetch path.
- Updated localized landing and generator copy to focus on uploaded or recorded media transcription.

### Removed
- Removed unused YouTube caption service helpers, disabled YouTube API routes, importer UI, and stale generator example messages.

## [0.12.2] - 2026-06-13

### Changed
- Soft-disabled new YouTube caption imports while preserving access to existing YouTube transcript pages.
- Hid YouTube import entry points and YouTube-specific usage/pricing rows until the caption fetch backend is moved off the Worker path.

## [0.12.1] - 2026-06-13

### Changed
- Added safer diagnostic logging for YouTube caption fetch failures, including watch page, consent, bot-check, and Innertube response signals.

## [0.12.0] - 2026-06-13

### Added
- Added YouTube caption import from pasted video URLs, including caption track selection, video embeds, grouped transcript display, and playback-linked transcript highlighting.
- Added separate YouTube caption import quotas, video duration limits, inspect rate limiting, and D1 metadata for YouTube transcripts.
- Added OpenAI-backed transcript summaries with sanitized user-facing errors.
- Added sidebar usage for both transcription minutes and YouTube caption imports.
- Added stable pricing feature row keys and shared compact feature-row builders for pricing and billing pages.

### Changed
- Simplified dashboard billing into compact paid plan comparison cards and moved current plan usage into the sidebar.
- Simplified public pricing cards to focus on purchase-decision features, with shared paid features shown in a separate section.
- Hid translation controls for YouTube-sourced transcripts while keeping summaries available.
- Improved upload transport retry handling, retry UI, and upload failure analytics diagnostics.

### Fixed
- Removed localized pricing feature selection that depended on English labels or hidden row positions.
- Prevented OpenAI/provider implementation details from appearing in user-facing summary errors.
- Prevented YouTube caption fetching from using unvalidated caption hosts.

### Removed
- Removed the landing generator example list from the primary tool section.

## [0.11.0] - 2026-06-11

### Added
- Added a reusable upgrade plan modal for transcript AI tools and upload quota errors.
- Added quota upgrade prompts across upload, recording, home upload, and audio-only upload surfaces.
- Added separate `paddle_load_fail` analytics for Paddle SDK and overlay loading issues.

### Changed
- Lazy-load Paddle only after signed-in checkout intent instead of initializing Paddle for every page visitor.
- Reused shared upload error handling across recorder and audio upload cards.

### Fixed
- Prevented passive Paddle.js preload failures from being counted as checkout failures.
- Allowed Paddle config and initialization to retry after recoverable soft failures during the same page session.

### Removed
- Removed the global Paddle provider and its page-load checkout failure tracking.

## [0.10.0] - 2026-06-09

### Added
- Added paid AI translation and AI summary support for completed transcript detail pages.
- Added translation and summary storage metadata, R2 cleanup coverage, and localized pricing feature rows.
- Added clearer upload failure handling with extraction guidance for oversized video/audio cases.

### Changed
- Reworked paid feature upgrade prompts into a compact plan selector with localized plan copy and plan-derived prices and limits.
- Localized non-English sidebar dashboard labels and paid feature upgrade modal copy.

### Fixed
- Prevented raw upload service error codes from being shown to users while preserving machine-readable error codes for analytics and cleanup logic.
- Prevented empty translation responses from being cached as completed translations.

## [0.9.0] - 2026-06-08

### Added
- Added Paddle subscription ID storage in D1 so billing records can track the active subscription.
- Added plan-aware upload limit copy for free, Starter, and Pro accounts on the new transcript dashboard.

### Changed
- Kept the sidebar New Transcript action visible for signed-out users and routes them through Google sign-in before upload.
- Updated billing and pricing plan actions so paid users keep the current plan, avoid duplicate checkout, and contact support for upgrades.
- Switched local D1 development back to local bindings by default instead of remote D1.

### Fixed
- Fixed Paddle checkout success returns to land back on the intended billing/pricing success URL.
- Fixed sidebar usage loading to create or refresh the current user row before displaying quota.

## [0.8.0] - 2026-06-08

### Added
- Added a localized `/mp3-to-text` landing page with MP3-focused upload, metadata, JSON-LD, sitemap coverage, and sidebar navigation.
- Added MP3-to-text landing page copy and reference documentation, with translations across French, Spanish, Italian, Japanese, and German.
- Added checkout analytics events for Paddle checkout clicks, transaction creation, overlay opens, completions, closures, and failures.

### Changed
- Made the audio upload card accept route-specific file picker hints and analytics attribution.
- Aligned video landing documentation and progress notes with the currently supported transcript export formats.

## [0.7.16] - 2026-06-07

### Changed
- Updated public pricing to present Pro Unlimited at $179/year with 2,400 monthly priority minutes and localized feature rows across all supported languages.
- Reworked pricing plan cards to render localized feature rows from message files and round annual monthly-equivalent pricing up to whole dollars.
- Aligned all plan upload size enforcement and upload copy around a conservative 1 GB file limit.

### Removed
- Removed unused pricing translation fields that duplicated feature-table data.

## [0.7.15] - 2026-06-07

### Fixed
- Restored the Paddle pricing CTA to the same direct-overlay path as `ai-music`: wait for Paddle.js, briefly allow the new transaction to become available, then call `Checkout.open({ transactionId })` without redirecting production clicks to the `_ptxn` fallback URL.

## [0.7.14] - 2026-06-07

### Fixed
- Kept a Paddle checkout event callback registered during initialization so production transaction overlays continue opening reliably without temporary client diagnostics.

## [0.7.13] - 2026-06-07

### Fixed
- Matched `ai-music` Paddle checkout behavior by redirecting to Paddle's returned transaction URL if the overlay SDK is unavailable or fails to open.

## [0.7.12] - 2026-06-07

### Fixed
- Fixed local Paddle checkout testing by letting the create-checkout API use `.env.local` Paddle settings in development while keeping production on Worker environment variables.
- Sent Paddle checkout return data as a relative pricing-page path so local testing no longer passes `localhost` as the Paddle checkout domain.

## [0.7.11] - 2026-06-07

### Fixed
- Matched the working Paddle overlay flow from `ai-music` by creating checkout transactions with the current pricing-page URL instead of `/dashboard`, so Paddle receives a page where Paddle.js is already mounted.

## [0.7.10] - 2026-06-07

### Fixed
- Fixed paid pricing buttons silently doing nothing when Paddle.js has not finished initializing; checkout now creates the transaction first, waits briefly for Paddle.js, and then opens the overlay.
- Prevented local Paddle API failures from becoming a Next.js dev overlay by handling non-OK checkout responses without throwing from the click handler.

## [0.7.9] - 2026-06-07

### Changed
- The Paddle create-checkout route now surfaces Paddle's real API error (`paddleStatus`/`paddleCode`/`paddleDetail`) instead of a bare `paddle_api_error`, so checkout failures (e.g. a price ID that doesn't exist in the active Paddle environment) are diagnosable from the response.

## [0.7.8] - 2026-06-07

### Fixed
- Fixed Paddle overlay failing to open: the checkout button now opens a pre-created transaction with only its `transactionId`, dropping the `settings`/`successUrl` override that Paddle.js rejects in transaction mode.
- Set each Paddle transaction's `checkout.url` to the actual post-checkout success URL (built from `successPath`) instead of the pricing page, making the transaction the single source of truth for the return URL.

## [0.7.7] - 2026-06-07

### Fixed
- Kept Paddle pricing buttons clickable while Paddle.js finishes initializing, without restoring hosted checkout redirects.

## [0.7.6] - 2026-06-07

### Fixed
- Removed Paddle hosted checkout redirects from pricing buttons so paid checkout opens only through the overlay.

## [0.7.5] - 2026-06-07

### Fixed
- Corrected Paddle transaction fallback URLs to use the Scribix pricing page instead of the post-checkout dashboard path.

## [0.7.4] - 2026-06-07

### Fixed
- Set Scribix-specific Paddle checkout URLs on transactions so fallback checkout stays on `scribix.io`.

## [0.7.3] - 2026-06-07

### Fixed
- Retried Paddle checkout creation without a reused customer ID when production Paddle cannot find an older customer.
- Ensured production deploys build Paddle.js with the public production Paddle environment from `.dev.vars`.

## [0.7.2] - 2026-06-07

### Changed
- Added production Paddle client and price configuration to the Worker config.
- Updated annual pricing display to show the monthly equivalent with the annual total as secondary billing text.

## [0.7.1] - 2026-06-07

### Fixed
- Updated the refund policy to match Paddle's 14-day refund request requirement without usage-based qualifiers or fee deductions.

## [0.7.0] - 2026-06-07

### Added
- Added Paddle Billing checkout, portal, and webhook handling for Starter and Pro subscriptions.
- Added Paddle plan configuration, client-side Paddle initialization, and D1 webhook event deduplication.
- Added Paddle setup documentation, launch checklist items, and required environment variable references.

### Changed
- Replaced the Creem billing flow with Paddle-backed pricing, account billing, and subscription state updates.
- Updated legal pages and footer to identify CENDRO LABS PTY LTD as the operator of Scribix and disclose Paddle billing.
- Aligned public retention copy with the 7-day audio and video deletion policy.

### Removed
- Removed legacy Creem checkout, portal, webhook, and plan helpers.

## [0.6.0] - 2026-06-02

### Added
- Added a logged-in dashboard feedback widget that sends private user feedback to a dedicated Discord webhook.
- Added `/api/feedback` with authentication, message validation, link limits, cooldown protection, and Discord mention suppression.
- Added localized feedback widget copy across supported locales and setup documentation for `DISCORD_FEEDBACK_WEBHOOK_URL`.

## [0.5.0] - 2026-05-31

### Added
- Added Microsoft Clarity analytics tracking alongside existing Google Analytics and Plausible scripts.
- Added Clarity forwarding for custom analytics events and properties.
- Added tool-level transcription attribution for audio-to-text, homepage, and dashboard upload flows.

### Changed
- Extended transcription success and failure events with source and input type metadata.

## [0.4.0] - 2026-05-31

### Added
- Added a persistent SaaS-style sidebar for the main and audio-to-text landing pages with quick switching between tools and the dashboard.
- Added a collapsible desktop icon rail, mobile drawer behavior, account avatar menu, language/theme controls, and signed-in usage display in the sidebar.

### Changed
- Moved landing-page navigation, account, language, and theme controls out of the header and into the sidebar shell.
- Renamed the sidebar library entry to Dashboard and removed unavailable social transcript and pricing links from the visible sidebar.

### Fixed
- Fixed mobile drawer close behavior with explicit pointer and keyboard handling plus ghost-click reopen suppression.
- Hid the usage meter for signed-out visitors to avoid implying account quota before sign-in.

## [0.3.0] - 2026-05-25

### Added
- Added a transcript export panel with TXT, DOCX, SRT, VTT, CSV, audio download, copy, and timestamp controls.
- Added transcript viewer action placeholders and localized message keys for supported locales.

### Changed
- Reworked the transcript detail page into a wider viewer/export layout.
- Added timestamp-aware TXT and DOCX export formatting.

### Fixed
- Show a clearer timeout message when browser audio extraction takes too long.
- Preserve timestamped DOCX downloads from the dashboard row menu.

### Removed
- Removed the self-serve account deletion button from the account page.

## [0.2.2] - 2026-05-21

### Changed
- Purge legacy soft-deleted non-completed transcript rows from D1 during cleanup.

## [0.2.1] - 2026-05-21

### Changed
- Updated cleanup retention so expired non-completed transcripts are hard-deleted after their TTL, while completed transcripts remain retained.

## [0.2.0] - 2026-05-21

### Added
- Added a scheduled Cloudflare cleanup Worker for stale pending jobs, failed transcripts, and expired audio.
- Added an R2 layout migration script for moving transcript assets to user-first object keys.

### Changed
- Extended audio retention from 7 days to 14 days across the app and cleanup policy.
- Switched R2 audio and transcript keys to the `users/{userId}/{transcriptId}` layout.
- Updated Cloudflare context access to use the async OpenNext runtime API.

### Fixed
- Added scrubbed failure summaries to transcription failure analytics.

## [0.1.10] - 2026-05-20

### Added
- Added the Dang.ai partner badge to the homepage.

### Fixed
- Added stalled-upload timeout handling, one retry, and structured upload error logging for direct R2 uploads.

## [0.1.9] - 2026-05-11

### Added
- Added Plausible custom events for tool visits, sign-in success, transcription outcomes, and downloads.
- Added a migration for YouTube transcript sources and more granular transcript processing statuses.

## [0.1.8] - 2026-05-10

### Added
- Added Google Analytics and Plausible tracking scripts to the root layout.

## [0.1.7] - 2026-05-10

### Fixed
- Removed the root layout theme script that triggered React client-render warnings.
- Normalized the default home canonical and sitemap URL to the slash root.

## [0.1.6] - 2026-05-10

### Fixed
- Added canonical metadata and hreflang alternates for localized home pages.
- Removed localized legal-page alternates from the sitemap and pointed legal metadata to English canonical URLs.

## [0.1.5] - 2026-05-10

### Changed
- Made legal pages canonical English-only pages and removed provider-specific legal copy.
- Hardcoded the footer copyright line and removed duplicate footer copyright/credit translations.

### Fixed
- Prevented localized legal-page redirect loops when a non-English locale cookie is active.
- Replaced the raw theme initialization script with Next.js script handling.

## [0.1.4] - 2026-05-09

### Changed
- Localized dashboard, upload, transcript viewer, billing, and account actions across supported languages.
- Reworked transcript row actions with translated labels and a custom delete confirmation flow.

### Fixed
- Improved dashboard action menu positioning and localized upload/record error messages.

## [0.1.3] - 2026-05-08

### Changed
- Switched local preview and D1 bindings to use the remote Cloudflare database.
- Renamed Cloudflare account environment usage from `CF_ACCOUNT_ID` to `CLOUDFLARE_ACCOUNT_ID`.
- Resolve authenticated users through the database before applying app state and transcript ownership checks.
- Extract video audio before creating transcript rows and add browser-native audio extraction fallback.

### Fixed
- Prevent failed pre-submit uploads from leaving orphan transcript rows.
- Fixed dashboard transcript action menus being clipped by the table container.

## [0.1.2] - 2026-05-08

### Removed
- Removed the `QUOTA_BYPASS` escape hatch so tier duration, upload size, and minute quota limits are always enforced.

## [0.1.1] - 2026-05-08

### Changed
- Added production Worker environment variables for Scribix deployment.
- Ignored local Worker secret setup files so credentials stay out of Git.

## [0.1.0] - 2026-05-07

### Added
- Added initial launch changelog for the Scribix production preflight.

### Changed
- Switched locale routing from Next `proxy.ts` to Cloudflare-compatible middleware for OpenNext deployment.
- Changed browser video extraction to load the pinned FFmpeg core from CDN instead of Worker static assets.
- Disabled the YouTube generator tab until backend support is available.

### Removed
- Removed oversized bundled FFmpeg public assets that exceeded Cloudflare Workers asset limits.
- Removed obsolete API documentation draft from the repository.
