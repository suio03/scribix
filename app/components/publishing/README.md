# Scribix publishing workspaces

Adapted directly from the user-owned ClipFlight (Teleo) web workspaces at commit
`cb83f86`: AccountsWorkspace, ComposeWorkspace, HistoryWorkspace, their connection
and action dialogs, icons, platform contracts and history polling logic.

Scribix owns the shell, localization, media selection and authentication. The
scoped stylesheet retains the workspace layout while using Prism Pulse tokens.
There is no runtime import from the neighboring repository and no browser access
to the ClipFlight application key.

- `/dashboard/accounts`: provider filters, channel cards, connection and
  grant-wide disconnect confirmation. Available before uploading a video.
- `/dashboard/publish`: an owned, current exported clip is loaded via
  `/api/social/review`. The editor links here with project, candidate and render
  IDs. Caption, title, selected accounts and settings survive a return from
  channel management; creator settings are freshly checked. Confirmation is
  deliberately reset when reopening a draft.
- `/dashboard/publishing`: user-scoped submission history and service-authorized
  target retry. The integration does not expose deletion or scheduling, so those
  first-party Teleo controls are omitted. YouTube and LinkedIn are offered; TikTok remains paused,
  with one selected channel per platform.

The service still owns provider authorization, media import, platform validation,
publishing and retry safety. Scribix's existing submission route checks ownership,
media expiry and the saved render dependency before transferring a video. An
uncertain transfer retains its exact request ID and body in session storage;
the form is locked until that request can be resolved. No provider token or
signed media URL is stored in the browser draft.

History polls at 10 seconds, refreshing at most three active records per request;
terminal records are read from the persisted result. This respects the external
API's request budget for normal use. The server's application rate limit remains
authoritative across multiple tabs. History is limited to the latest 30 entries.

When updating from Teleo, compare the source workspaces and API contracts first.
Do not restore its independent sidebar, billing, scheduling, media-upload flow or
unsupported platforms inside Scribix.

LinkedIn contracts and icon were ported from Teleo on 2026-09-12. Videos publish publicly to personal profiles. Teleo migration `0018_external_linkedin.sql` and its API adapter are deployed; the hosted connection now proceeds directly to provider authorization. OAuth and provider secrets remain in Teleo.
