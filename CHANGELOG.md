# Changelog

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
