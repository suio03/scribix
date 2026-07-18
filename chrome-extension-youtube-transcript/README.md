# Scribix YouTube Transcript Chrome Extension

Manifest V3 Chrome extension for the Scribix YouTube transcript panel.

## Scope

- Chrome desktop only.
- The manifest matches YouTube broadly so the extension can follow YouTube SPA navigation.
- The panel only mounts on desktop YouTube `watch` pages with a video ID.
- Anonymous users can extract 10 YouTube transcripts per day.
- AI Summary is visible to everyone, but generation requires a paid Scribix session.
- The panel follows the user's system light/dark theme.
- Successful transcript responses are cached locally for repeat visits and refreshes.
- Transcript downloads are available as TXT, SRT, VTT, and CSV.
- Shorts, mobile YouTube, history, DOCX export, and editing are out of scope for v1.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder.
5. Open a YouTube desktop watch page.

## API Target

The extension points to `https://scribix.io` in `background.js`.
For local testing, temporarily change `API_BASE` to `http://localhost:3000`, add
`http://localhost:3000/*` to `host_permissions` in `manifest.json`, and run Scribix with:

```sh
npm run dev
```

The extension calls:

- `GET /api/extension/account`
- `POST /api/extension/youtube/transcript`
- `POST /api/extension/youtube/summary`
