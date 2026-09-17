# TikTok production release — 2026-09-17

The owner confirmed Direct Post **Approved** and production Domain verification for `clipflight.com` with TikTok console screenshots. Domain verification covers `app.clipflight.com` ([TikTok media transfer guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide)). This record supersedes the earlier audit-pending notes in social-publishing.md. Owner performs the real account authorization and publication acceptance.

## Production integration

- Dedicated application: `040e55cc-c645-4cdd-9827-c7291036cdce` (Scribix production integration).
- Exact callback: `https://scribix.io/api/social/callback`.
- `enabled=1`, `tiktok_pull_verified=1`; media origin and `/scribix-media/` prefix match the existing Scribix R2 source configuration.
- Dedicated credential is installed as Scribix Worker secret `CLIPFLIGHT_API_KEY`. No key is committed. Authenticated read-only account query returned 200.
- The existing local application `b5476f7a-4596-420b-acbc-ab897edc20a0` and its `local.scribix.io` callback remain separate. Production accounts must be connected independently.
- Teleo's deployed application base is `https://app.clipflight.com`. A real existing imported video returned HEAD 200 and Range GET 206 with MP4 bytes through `/platform-media/…mp4`, with no redirect. No new post was created.

## Database and release preparation

Cloudflare D1 Time Travel recovery bookmark before migrations: `00001d77-00000002-000050e9-0b075ff46f5dccf2d0d6c83a72b44aa8`. Recovery remains on Cloudflare; no complete production database was downloaded.

Applied Scribix migrations `0037_publish_preparation.sql`, `0038_social_connections.sql`, `0039_social_submissions.sql`, `0040_independent_social_accounts.sql`, and `0041_social_publish_batches.sql`.

The release combines the committed publishing implementation with current remote-main footer changes. Uncommitted planner, manual source selection and project-library development are excluded. Production TikTok availability is explicitly configured in wrangler.jsonc; required secrets are declared by name. Type generation uses non-literal environment variable types to support the existing local environment overrides.

## Renderer dependency repair

The original candidate image failed the required HIGH/CRITICAL scan. The release applies Debian security updates, removes unused Node/Python package managers and cached installation wheels from the runtime, and pins patched `protobuf==5.29.6` and `msgpack==1.2.1`.

MediaPipe 0.10.21 is retained for its full-range graph and local AMD64 CPU compatibility. Its conservative `protobuf<5` package constraint is explicitly overridden after installation. Protobuf's Python gencode compatibility is documented [upstream](https://protobuf.dev/support/cross-version-runtime-guarantee/#python-specific-guarantees); its pure-Python implementation is selected because the newer native runtime's graph text serialization is incompatible with MediaPipe's bundled C++ parser. Do not remove `PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python` without repeating actual inference checks. The final image passed the real Node → Python full-range detector startup and a six-second licensed real-person sample through MediaPipe/TalkNet (one fill point, no fallback).

Final local image: `sha256:fcdc076b79699afa44de91e18a6bd2a78802e4ef354857812b6b904752cbb4e8`. Trivy 0.74.0 and `test:video-security` passed with no fixable HIGH/CRITICAL findings; this is not a claim of zero vulnerabilities at every severity.

Next.js/OpenNext build, six-language parity, publish workflow, video workspace, platform batch, auth, AI candidates, export monitor, tracking and framing diagnostics passed. Real MP4/JPG/ZIP composition and 24-case rendering benchmark passed. The final 15/30/45-second real-source matrix passed at 1080×1920 H.264/AAC under 1 CPU / 3 GiB, taking 29.0 / 68.8 / 117.3 seconds locally under AMD64 emulation. This does not establish production latency. Remote migration readback found no pending migrations or foreign-key violations; required tables, nullable project callback, batch ID, asset hold, framing field, concurrency triggers and scope indexes are present.

## Completed production deployment

- Release commit: `e60aaf8` on `main`, pushed and remote SHA verified.
- Scribix Worker: `dd4c909d-7e8f-4b28-8458-f0f31e0c0d42`.
- Render dispatcher: `9538acb5-9624-498f-bba5-86ca9257d23c`.
- Container application: `a0331bd1-c9b2-4522-baac-0f9d20868582`; registry manifest `sha256:085e02ea3e8c153d25653b91a2cff1a861ef3512d78ef16de5d902ac49b99328`, built from the scanned local image above.
- Cleanup Worker: `04ff1019-fd42-4d45-97b0-3e4dc1c05ca1`.

Readback confirmed the active Scribix version contains the dedicated secret, `CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED=true` and production `NEXTAUTH_URL`. The homepage returns 200; Google auth provider metadata returns 200 with the existing production callback. Explicit `/en/` publishing/account URLs redirect to their canonical default-language routes. Anonymous social availability is correctly denied. These are operational checks, not signed-in UI or real-provider acceptance.

Owner acceptance starts at `/dashboard/accounts` to connect production channels, then `/dashboard/publishing` to publish an owned exported clip. No OAuth grant or public/private test post was submitted during deployment. The existing local development work was preserved byte-for-byte for all 27 previously modified tracked files.

