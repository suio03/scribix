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
- The clip editor has one editing workspace and explicit **Download** and **Publish** actions. Opening titles are edited with captions, and cover text with cover controls. Publish navigates to `/dashboard/publish` with the project and clip selected. It reuses the current video or generates it without downloading it. Cloud-file deletion is not an editing action.
- `/dashboard/publish`: account checkboxes select destinations; platform tabs independently select which caption and settings to edit. Each platform keeps its own caption, including after returning to editing or regenerating the video. One action submits all selected platforms, using separate immutable requests so each receives its own text. Request IDs and accepted submissions survive a page reload; retries skip accepted submissions. The UI distinguishes submission from actual platform publication, which is shown in History. Starting another post after a completed submission is explicit.
- Platform-specific required settings remain authoritative. The Publish action itself provides the API confirmation; no extra review or YouTube certification checkbox is shown. When YouTube is selected, a localized notice linking to its terms appears beside the submit action. Certification is included only in the YouTube request created by that action. No scheduling or custom social-cover upload is exposed because the current integration does not support them. Account management and editor return links preserve the current clip and publishing draft. Uncertain legacy submissions retain their existing request IDs; no provider token or signed media URL is persisted in the browser draft.
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

## Unified publishing history (local implementation, 2026-09-16)

New submissions navigate immediately to History at `/dashboard/publishing?task=<uuid>`, with the current task highlighted among all records.
The browser saves immutable platform requests before navigation, scoped to the
signed-in user in localStorage; reopening that task resumes unaccepted requests
with the same IDs. Reopening the same unchanged publishing form resolves to the
same task. No File or signed preview URL is retained. Once accepted by Scribix,
requests are persisted in D1 and provider transfer starts through Worker
`waitUntil`; reading History also recovers interrupted transfers. This is not a
new durable queue: requests not yet accepted by Scribix require the browser to
resume, and interrupted provider transfers can require a progress/history read.

Migration `0041_social_publish_batches.sql` adds grouping and display metadata.
History groups only explicit batch IDs, never timestamps or video IDs. Each
platform keeps its own caption, remote post ID and service-authorized retry.
Older records remain separate because they have no verified shared task ID.

`/dashboard/publish?demo=1` is available on localhost only. It simulates both
success and a LinkedIn failure/retry using the same history/progress renderer,
without calling media, render, submission or provider APIs. Demo state is
separate from real tasks and survives a refresh. It validates UI behavior, not
provider acceptance. No remote migration or deployment has been performed.

Navigation refinement: Channels is the sole sidebar entry for account management; Publishing contains only New post and History. Submission opens History with the current task highlighted among all records. There is no separate progress screen; the task query preserves recovery and highlighting. The local demo follows the same New post → History navigation.
