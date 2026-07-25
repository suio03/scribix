# Scribix YouTube Transcript Browser Extension

Manifest V3 browser extension for the Scribix YouTube transcript panel.

## Scope

- Chrome, Microsoft Edge, and Firefox desktop.
- The manifest matches YouTube broadly so the extension can follow YouTube SPA navigation.
- The panel only mounts on desktop YouTube `watch` pages with a video ID.
- Anonymous users can extract 10 YouTube transcripts per day.
- AI Summary is visible to everyone, but generation requires a paid Scribix account.
- The panel follows the user's system light/dark theme.
- Successful transcript responses are cached locally for repeat visits and refreshes.
- Transcript downloads are available as TXT, SRT, VTT, and CSV.
- Shorts, mobile YouTube, history, DOCX export, and editing are out of scope for v1.

## Build

Run builds from the repository root:

```sh
npm run extension:local
npm run extension:edge:local
npm run extension:firefox:local
npm run extension:all:zip
```

Unpacked builds are written to `.extension-build/<browser>/<mode>`. Production ZIP
files are written to the repository root. The Firefox build uses an event-page
background script and includes the Gecko ID and data-collection declarations required
for AMO signing.

## Load Unpacked in Chrome or Edge

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `.extension-build/chrome/local` for Chrome or
   `.extension-build/edge/local` for Edge.
5. Open a YouTube desktop watch page.

For Edge, `edge://extensions` opens the corresponding extensions page.

## Load Temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click Load Temporary Add-on.
3. Select `.extension-build/firefox/local/manifest.json`.
4. Open a YouTube desktop watch page.

## API Target

Production builds point to `https://scribix.io`. Local builds point to
`http://localhost:3000` and add the matching host permission. Run Scribix locally with:

```sh
npm run dev
```

The extension calls:

- `POST /api/extension/auth/authorize`
- `POST /api/extension/auth/token`
- `POST /api/extension/auth/revoke`
- `GET /api/extension/account`
- `POST /api/extension/youtube/transcript`
- `POST /api/extension/youtube/summary`

Chrome, Edge, and Firefox use the browser `identity` API with PKCE. The
extension stores a 15-minute access token and a rotating, revocable refresh
token with an absolute 30-day expiry in extension-local storage. It does not
send Scribix website cookies to extension APIs. The account button in the panel
revokes the refresh session and clears the local tokens when the user logs out.

The published Chrome callback is fixed to the Chrome Web Store extension ID.
Firefox uses the callback derived from the manifest Gecko ID. Before production
Edge login can work, set `EDGE_EXTENSION_ID` in the Scribix deployment to the
32-character ID assigned by Microsoft Partner Center.
