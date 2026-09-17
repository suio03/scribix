# Scribix social publishing through ClipFlight

Current record summary, 2026-09-18 (reconciled with recorded evidence, not a new remote check): the social publishing release was deployed on 2026-09-17, including the approved TikTok Direct Post integration and production flag. See [production release and readback evidence](tiktok-production-release-2026-09-17.md). Real TikTok account authorization/publication remains owner acceptance; deployment does not establish a successful post. The newer Planner/scheduling and AI Clips workflow changes remain local and are not part of that production release. The owner previously confirmed YouTube public-publishing verification; complete new-project Scribix acceptance, real LinkedIn OAuth/publication and provider renewal remain unconfirmed.


Local UI update, 2026-09-15: the earlier in-page dialog was replaced by a dedicated `/dashboard/publish` page carrying the selected project and clip. A stale video is generated automatically without starting a download. Account checkboxes choose multiple destinations; platform tabs edit independent captions and settings without changing those selections. One user action sends separate immutable submissions, each with the matching caption. The persisted batch skips accepted submissions on retry and keeps original request IDs after response loss or reload. History reports platform publication results. No public post or new OAuth authorization was performed during this UI verification. Scheduling and custom platform cover upload remain unsupported. Run `test:platform-batch` for caption separation and retry safety.

Earlier local evidence: Clip 4 generation and transition to the platform form were verified, along with caption switching and account-management return. These checks were performed before the modal was replaced; the replacement page flow was then verified locally: editor-to-publish navigation, two selected accounts, tab switching without deselection, independent captions surviving editor return and reload, and account-management return. The final submit button was not clicked.

The dated sections below retain setup and acceptance evidence. Later dated records supersede earlier blockers; they do not prove a tunnel or local server is still running. Product status and next steps are summarized in the [product plan](../roadmap/video-product-plan.md).

The existing `/publish` route still generates copy. New `/social/connections` and `/social/posts` routes live below `/api/video-projects/:id` and derive user identity from the Scribix session. The fixed OAuth return is `/api/social/callback`.

`CLIPFLIGHT_API_KEY` must be a server-side secret for the dedicated Scribix application. Publishing is available to signed-in paid users (Pro and grandfathered Basic) when `CLIPFLIGHT_API_KEY` is configured, in both local and production environments. There is no user-ID allowlist; routes still enforce authentication and ownership, and upstream requests retain per-user isolation. The dedicated application pins an exact return URL: the configured local integration uses `https://local.scribix.io/api/social/callback`; production must explicitly configure its production callback. Source access is restricted to the configured Scribix R2 account and `/scribix-media/` prefix. As of the 2026-09-18 local change, Free accounts can browse illustrative workspace previews for Posts, Planner and Channels; all social API entry points check the current stored tier and return 402 before provider calls or mutations. Owning an exported MP4 does not grant social publishing access. The paid gate was deployed on 2026-09-18 (Melbourne), application version `326e49d2-21aa-4d10-b377-7e7b288903a4`.

The submission freezes the final render version and publishing inputs. Video dependencies exclude cover-only settings and copy. Final MP4 readiness does not depend on cover/ZIP completion. The signed source request is encrypted using a key derived from the application credential and retained only until submission acceptance or expiry. Rotating that credential invalidates any unsent encrypted submissions; let those expire and submit again after checking the platform result.

The source asset receives a one-hour automatic-cleanup hold. Cleanup and submission use mutually exclusive D1 leases to prevent a stale sweep deleting held media. Explicit user deletion can still make a pending import fail. Platform upload initialization with an uncertain result is never automatically repeated. Safe target retries are limited to failures before platform initialization.

The six-language flow uses independent accounts, compose and history workspaces; the editor links to compose for a current exported video, including a ready MP4 whose cover generation failed. Copy is preserved in session storage through account connection redirects. TikTok privacy requires an explicit choice; interactions default off. Server creator-info checks run again before TikTok initialization. YouTube processing and visibility must be confirmed by the platform before the external API reports publication success.

Release dependencies (reconcile applied migrations against the actual remote state):

1. Follow the [Scribix migration checklist](operations.md#deployment), including both `0037` files and `0038`–`0040`. ClipFlight / Teleo needs `0014`–`0018` for this integration; later dated records below establish deployment of those external migrations, superseding the 2026-09-10 pending snapshot. The access-refresh route has a separate outstanding deployment dependency.
2. Deploy the compatible video Container described in `publish-preparation.md`, then the schema-dependent app and cleanup Worker.
3. Configure the dedicated application credential and exact return URL for the target environment. TikTok Direct Post approval was confirmed on 2026-09-17; separately verify URL/pull verification and the delivery configuration in ClipFlight for the target environment.
4. Use ClipFlight main/Cloudflare Builds and Scribix's existing `npm run deploy` script when deploying the respective service. The 2026-09-17 production deployment is recorded in [the release evidence](tiktok-production-release-2026-09-17.md); subsequent local scheduling changes require a separate release.
5. Owner reviews visuals and verifies each enabled platform with the correct account and an owned video. Record final video links and submission IDs for the Scribix flow; TikTok Direct Post approval is confirmed, but real publishing acceptance remains outstanding. Complete the relevant platform acceptance before production launch.

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
tool, pricing and dashboard sidebars consistent for signed-in accounts when the publishing service is configured.
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

### Channel feedback and manual renewal (2026-09-13)

Connection/disconnect feedback can be dismissed; dismissing an OAuth error also removes its callback query marker. Channels with refresh credentials expose Refresh access; other channels retain Reconnect. The authenticated, same-origin PATCH `/api/social/connections` adapter forwards to ClipFlight POST `/api/v1/accounts/:id/refresh`. The backend scopes the account to the external user's workspace and reuses its encrypted token service; only expiry metadata reaches the browser. Shared-grant channel expiry updates together. Refresh errors preserve existing connections.

This integration requires the new Teleo external refresh route to be deployed. Local verification does not establish a successful real-provider renewal; no deployment or GitHub push is included in this change.

### 2026-09-15: remove the user pilot gate

At the product owner’s request, removed the user-ID allowlist for local and production use. Earlier pilot-only records above describe historical behavior. The service credential, authenticated user, ownership checks and platform-specific availability still apply. TikTok remains paused under its existing platform approval gate. No production deployment or real platform publication was performed as part of this change.

Verification: all 30 publishing workflow tests and the OpenNext production build passed. In Chrome ai-publisher at localhost:3000, the signed-in publishing page displayed both sidebar entries (Publishing accounts and Publishing) and the Channels / New post / History navigation. This verifies entry visibility, not successful platform publication.

### Unified task progress — 2026-09-15 local change

Apply `0041_social_publish_batches.sql` before deploying this version. New
platform submissions share a batch ID and display as one history card with
independent captions and retry targets. The submission response accepts the
persisted request without waiting for media transfer; Worker background work
starts the transfer, and progress reads recover unfinished work. Browser-local
requests resume with their original IDs. The localhost-only publishing demo
performs no uploads or posts. See the publishing component README for recovery
limits. Existing ungrouped history is not retroactively merged.

Navigation refinement: Channels is the sole sidebar entry for account management; Publishing contains only New post and History. Submission opens History with the current task highlighted among all records. There is no separate progress screen; the task query preserves recovery and highlighting. The local demo follows the same New post → History navigation.

### Workspace navigation and scheduling (local implementation, 2026-09-16)

- `/dashboard` is Home with the existing video uploader and six recent projects; `/dashboard/projects` is the full project library. Sidebar groups Projects/Transcripts under Create and Posts/Planner/Channels under Social media. Manual source selection is opt-in in the project.
- `/dashboard/planner` shows scheduled posts in the browser's displayed timezone, with month navigation, mobile list, per-platform rescheduling and cancellation. It reads the same `social_submissions` / provider results as Posts. Multiple platform submissions retain their own IDs so a failed operation does not alter a successful sibling.
- Compose accepts now/schedule and freezes mode, Unix timestamp and IANA timezone with the existing immutable submission. Minimum initial lead time is `MIN_SCHEDULE_DELAY_SECONDS`; Teleo's schedule limit remains one year.
- Teleo imports the MP4 immediately into its own media storage. Its existing versioned scheduled workflow owns later publication, account slots, rescheduling and cancellation. Scribix source URLs remain short-lived. No new migration or binding is required.
- Teleo must expose `GET /api/v1/publishing-capabilities` returning `scheduling: true` before Scribix can submit a schedule. Both creation and the shared outgoing transport enforce this; an older provider must never silently interpret a schedule as publish-now. `PATCH/DELETE /api/v1/posts/:id/schedule` check external application/user ownership before bridging to the existing schedule service.
- These changes are local only. Deploy Teleo before enabling real scheduling in Scribix; no production scheduling acceptance is claimed. Planner currently provides month/mobile-list and time changes/cancel, not the full Teleo week/drag/drop/content-edit UI.

## TikTok Direct Post approval (2026-09-17)

The owner supplied a TikTok developer-console screenshot showing Content Posting API → Direct Post enabled and Usage marked **Approved** (provisioned access for users). This supersedes the earlier Direct Post audit blocker. Local `.env.local` and `.dev.vars` now set `CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED=true`; restart the local runtime to load the restored flag.

The screenshot does not establish URL/pull verification, ClipFlight delivery configuration, Scribix production configuration, or a successful real publication. No remote configuration, deployment, OAuth authorization or public post was performed during this update. The subsequent [production release](tiktok-production-release-2026-09-17.md) records delivery/domain configuration and deployment. Remaining acceptance is account connection, creator-info flow and an owner-authorized publication with its final link and submission ID recorded.

### Paid access verification (2026-09-18, local)

Social access uses `lib/social-access.ts` as the shared entitlement rule: Pro and grandfathered Basic only, with unknown tiers denied. Account connections (including project-scoped routes), callbacks, media review, history, submissions, retries and scheduling check the stored user tier. The four social pages render an illustrative workspace for Free, with pricing-modal triggers on paid actions; the sidebar marks paid access, and the clip Publish upgrade action opens the existing pricing modal. Verification: 41 publishing workflow tests and 56 workspace tests passed, including Free rejection before provider calls/mutations and server-rendered page isolation. Six-locale validation and Next.js/OpenNext builds passed. The signed-in paid browser account still loads Channels. No new OAuth connection or publication was performed; the application changes were subsequently deployed as version `326e49d2-21aa-4d10-b377-7e7b288903a4`; real provider acceptance remains separate.

### Free workspace preview (2026-09-18)

The full-page upgrade card was replaced with the competitor-inspired workspace structure: a value banner and illustrative publishing diagram, channel management entry, Posts status tabs/platform filter and locked illustrative rows, browsable Planner months, and supported-platform connection cards. All paid action buttons open the existing `UpgradePlanModal` in place; existing paid workspaces and API entitlement checks remain in place. The sidebar badge reads PRO. Unlock, connection, new-post and calendar actions preserve the current page and open the existing pricing modal; closing preserves filters. The preview does not fetch protected history or accounts, and all example material is identified as illustrative. Chrome ai-publisher checks used a temporary local page rendering the real preview component, without changing account tiers: Posts tabs/filter, Planner next month and Channels cards were checked. Pricing-modal follow-up checks confirmed Unlock opens the existing modal without navigation, and closing it preserves the Scheduled tab and YouTube filter. Final Next.js/OpenNext build and six-locale checks passed. The temporary route was removed after verification.

### Production auth origin correction (2026-09-18)

The direct application deployment exposed a build-origin bug: `.env.local` supplied `AUTH_URL=http://localhost:3000`, which Auth.js prioritizes over `NEXTAUTH_URL`. A 200 response from `/api/auth/providers` was insufficient verification; its callback URLs pointed to localhost. Production now explicitly defines AUTH_URL alongside NEXTAUTH_URL and NEXT_PUBLIC_APP_URL, and the deploy script rejects missing or mismatched HTTPS origins. This correction is shipped through GitHub push at the owner's request; no further manual application deploy or verification is authorized in this pass.
