# Changelog

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
