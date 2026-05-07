# Changelog

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
