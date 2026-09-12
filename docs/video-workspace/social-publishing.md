# Scribix social publishing through ClipFlight

Scribix remains local; the ClipFlight API was deployed and the dedicated local integration enabled on 2026-09-11. No real-platform acceptance has been performed.

The existing `/publish` route still generates copy. New `/social/connections` and `/social/posts` routes live below `/api/video-projects/:id` and derive user identity from the Scribix session. The fixed OAuth return is `/api/social/callback`.

`CLIPFLIGHT_API_KEY` must be a server-side secret for the dedicated Scribix application. `CLIPFLIGHT_OWNER_USER_IDS` is a comma-separated pilot allowlist; no account is enabled by default. ClipFlight pins its application return URL to `https://scribix.io/api/social/callback` and accepts only the configured Scribix R2 account and `/scribix-media/` prefix. No additional purchase is required to publish an owned final MP4.

The submission freezes the final render version and publishing inputs. Video dependencies exclude cover-only settings and copy. Final MP4 readiness does not depend on cover/ZIP completion. The signed source request is encrypted using a key derived from the application credential and retained only until submission acceptance or expiry. Rotating that credential invalidates any unsent encrypted submissions; let those expire and submit again after checking the platform result.

The source asset receives a one-hour automatic-cleanup hold. Cleanup and submission use mutually exclusive D1 leases to prevent a stale sweep deleting held media. Explicit user deletion can still make a pending import fail. Platform upload initialization with an uncertain result is never automatically repeated. Safe target retries are limited to failures before platform initialization.

The six-language panel reuses `FinalRenderPanel`, including ready videos whose cover generation failed. Copy is preserved in session storage through account connection redirects. TikTok privacy requires an explicit choice; interactions default off. Server creator-info checks run again before TikTok initialization. YouTube processing and visibility must be confirmed by the platform before the external API reports publication success.

Release dependencies:

1. Apply and verify `0037`, `0038`, `0039` in Scribix and `0014`, `0015`, `0016` in ClipFlight. Remote read-only checks on 2026-09-10 found all six pending.
2. Deploy the compatible video Container described in `publish-preparation.md`, then the schema-dependent app and cleanup Worker.
3. Provision the dedicated application credential and owner pilot ID. Verify `https://app.clipflight.com/platform-media/` in TikTok and explicitly enable pull delivery in ClipFlight.
4. Use ClipFlight main/Cloudflare Builds and Scribix's existing `npm run deploy` script. No deployment has been performed in this implementation session.
5. Owner reviews visuals, connects both correct accounts from Scribix and publishes an owned video publicly on each platform. Record both final video links and submission IDs. Only after that acceptance may the pilot gate be broadened.

Validation: `test:publish-workflow` includes real SQLite tests for immutable social submission, free-tier final-video access, cover independence, cross-user denial and OAuth return replay. Run it with `test:video-workspace`, `check-locales` and `build:cloudflare`. These do not replace live streaming, OAuth, public visibility or visual acceptance.

## 2026-09-11 production API and local setup

Owner authorized using production ClipFlight directly for local Scribix testing; no test Worker is used. ClipFlight commit `cb83f86` was pushed to main and Cloudflare Builds deployed App version `394bcadc-8b93-4ace-ac08-153a1eb392d5`. Remote migrations 0014–0016 were applied and read back; foreign-key validation passed. ClipFlight 182 tests, full build, English UI scan and paired CSS checks passed.

Dedicated application `b5476f7a-4596-420b-acbc-ab897edc20a0` belongs to the owner's existing Workspace. Its exact return URL is `https://local.scribix.io/api/social/callback`; source access is restricted to the Scribix R2 origin and `/scribix-media/` prefix. Credentials are stored only in ignored local configuration; the pilot allows only the owner's local Scribix identity. TikTok pull remains disabled pending URL property verification. Local Scribix migrations 0038/0039 were applied.

Authenticated Node fetch verification returned 200 with an empty account list and 404 for a nonexistent connection session. This verifies application authentication and routing, not OAuth or publishing. Python urllib was rejected by Cloudflare with 1010; Node fetch matches the Scribix server adapter.

HTTPS setup is pending: existing Cloudflare credentials can list tunnels but DNS record reads return 403. No tunnel or DNS record was created. The owner has been asked to grant scribix.io DNS Read/Edit so a fixed local tunnel can be configured. The new domain also needs to be accepted by Scribix's Google login client before browser OAuth acceptance. Existing localhost login does not establish a session on the new hostname.

### HTTPS local entry ready

On 2026-09-11 the owner configured a dedicated `CLOUDFLARE_TUNNEL_API_TOKEN` in ignored `.env.local`. Tunnel `95f07b6e-4ddb-430a-b153-8d4991e02ad3` and proxied DNS for `local.scribix.io` were created. The tunnel initially used 3010 while Pixfy occupied 3000; after the owner requested port 3000 and it was confirmed free, both the tunnel and Scribix were switched to 3000. The full Scribix Wrangler/Queue/Container environment is running on 3000 with an ignored dispatcher config at `.wrangler/video-render.integration.jsonc`; Container callbacks use the same port. Local auth/application URLs now use `https://local.scribix.io`. Homepage returns 200 and auth provider metadata confirms `https://local.scribix.io/api/auth/callback/google`. Google client acceptance of this new URI and real user login remain unverified.

Restart the tunnel with `cloudflared tunnel run --token-file .wrangler/scribix-local-tunnel.token`. Restart the local app with `MINIFLARE_CONTAINER_EGRESS_IMAGE=cloudflare/proxy-everything:3cb1195 ./node_modules/.bin/wrangler dev -c wrangler.jsonc -c .wrangler/video-render.integration.jsonc --persist-to .wrangler/state --port 3000`. Both ignored configuration files are local setup artifacts, not deployable production configuration.

## Independent optional account management

2026-09-11: `/dashboard/accounts` and the sidebar “Publishing accounts” entry allow pilot users to connect before uploading. The upload page shows a secondary account summary and management link; account connection is never required to upload, edit or download. Existing final-render publishing reuses the same external user accounts and retains its connection fallback.

`/api/social/connections` shares handlers with the project-scoped connection endpoint. Identity always comes from the session; account-page requests cannot supply a different user or redirect destination. Migration `0040_independent_social_accounts.sql` preserves existing return records and makes `project_id` nullable. Null-project returns go to the localized account page; existing project returns keep their destination and one-time/user-bound checks. The migration has been applied locally only; apply it before deploying these Scribix changes.

Social mutation origin checks and callback redirects use the configured `AUTH_URL` / `NEXTAUTH_URL` public origin, falling back to the request origin when neither is configured. This fixes local Tunnel requests where Next.js uses an internal localhost URL; untrusted forwarded headers never select an allowed origin.

Verification: 23 publishing workflow tests, 56 workspace tests, six-language checks and production build passed. The new SQLite regression covers project-free connection, ignored injected destinations, pilot gating, cross-origin rejection, cross-user callback, replay and legacy project boundaries. In the signed-in ai-publisher browser, the account page loaded correctly and Connect YouTube reached the real ClipFlight connection page before any video upload. Platform authorization was not accepted. The upload page retained Choose video and showed the optional account management link. Full platform authorization/disconnect and narrow-screen interactive acceptance remain to be completed.

## Independent publishing workspaces (2026-09-11)

Distribution is now separate from the clip editor. Scribix directly adapts
ClipFlight's `AccountsWorkspace`, `ComposeWorkspace`, and `HistoryWorkspace`;
source provenance and API differences are documented in
`app/components/publishing/README.md`. The editor only links to a publishing
page once its saved video is current. The upload page retains an optional link
to channel management. Publishing requires a deliberate user action on the
independent page.

New read adapters: `/api/social/review` resolves the owned current MP4 and saved
copy; `/api/social/posts` lists the current user's latest submissions and proxies
safe target retry. No additional migration is required for this separation.
Migration 0040 is still required for the previously added independent connections.

Local tunnel testing revealed that stable webpack development scripts had been
cached by Cloudflare for four hours. Development-only CDN no-store headers and a
per-server development asset prefix avoid mixing old JavaScript with new HTML.
Production asset paths and caching remain unchanged.

On 2026-09-12 the owner clarified that TikTok App review passed, but the
separate Direct Post audit has only just been submitted and is **under review**.
TikTok indicated 2–4 weeks to contact the owner; this is not approval or a
promised completion date. The previous verification note did not establish
Direct Post audit approval. URL/pull verification and App review are distinct
from that audit.

TikTok is temporarily disabled in local `.env.local` and `.dev.vars`
(`CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED=false`). Account/connection pickers omit
TikTok, and the shared server transport blocks new TikTok connections,
creator-info requests, submissions (including stored submissions), and retries.
Existing account records and publishing history remain intact. YouTube stays
available. Restore the flag only after explicit Direct Post audit approval.
This change does not update production Scribix secrets or the separate
ClipFlight deployment/integration row; the previous remote pull-verification
value is not an audit approval flag.

Validation for this local workspace adaptation: 26 publish-workflow tests and 56
video-workspace tests passed; the three new adapter/review/idempotency tests also
passed after the final changes. All six locale files and the production Next.js
build passed. Browser checks used the logged-in ai-publisher profile: real YouTube
and TikTok channel cards, keyboard dismissal of the connection dialog, the
existing 42.366-second 1080×1920 MP4 (readyState 4), caption restoration after
reload, current TikTok creator privacy/interaction options, empty history, and
390px layout without horizontal overflow. Test caption and TikTok selection were
restored. No video was posted during this verification. These Scribix changes
remain local; this iteration did not deploy either application.

Platform settings use a single active tab panel rather than stacking every
selected platform's form. Tabs support arrow/Home/End navigation and show each
platform's readiness; all selected platforms are validated on submission and
form values remain in the parent draft when a panel is hidden. The owner
confirmed YouTube public-publishing verification on 2026-09-11, so the stale
private-only warning was removed. The existing provider forwards the selected
privacyStatus (defaulting to private only when no value is supplied).


## LinkedIn reuse (2026-09-12)

Scribix reuses Teleo's personal LinkedIn provider through the existing ClipFlight
external API. Accounts, compose selection, the public-profile notice, media
validation and history support LinkedIn; one channel per platform is retained.
TikTok remains paused, including hidden targets and retries, while YouTube and
LinkedIn can be selected together. OAuth and provider credentials stay in Teleo.

The Teleo adapter now includes LinkedIn in its public API platform contract,
account reads/disconnects and external submissions. Deploy migration
`0018_external_linkedin.sql` before this adapter (and the existing LinkedIn
`0017_linkedin_publish_receipts.sql` before its provider). Migration 0018 rebuilds
the connection-session platform constraint while preserving existing sessions.
Teleo migrations 0017/0018 and the LinkedIn adapter are deployed (recorded in
Teleo commit `26657a5`). The hosted connection page now redirects automatically
to the selected provider (`6329d10`), without a second confirmation. LinkedIn
requests use default Fetch redirect behavior (`06d1ba5`): the former explicit
`redirect: "error"` failed in Workers before token exchange. A real workerd test
now covers token exchange and identity reading; it uses mocked provider responses
and does not establish real-platform acceptance.

Scribix uses the same default Fetch behavior for its service adapter. Publishing
navigation is resolved centrally in `WorkspaceChrome`, keeping signed-in landing,
tool, pricing and dashboard sidebars consistent for enabled pilot accounts.
Scribix changes remain local; successful real LinkedIn OAuth and video publication
have not yet been confirmed in this task.

## Local verification (2026-09-13)

The complete Scribix working changes passed the production build and locale
parity checks, publish workflow (29 tests), video workspace (56), AI candidate
handling (11), export monitoring (4), and video tracking (5). The real publishing
render test passed with `/usr/local/bin/ffmpeg` (libass enabled), producing MP4,
JPG and ZIP and verifying reusable video and partial-failure behavior. The default
`/opt/homebrew/bin/ffmpeg` lacks the required subtitles filter on this machine.
These checks do not establish remote Scribix deployment or real LinkedIn posting.
