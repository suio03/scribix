# Browser Extension Publishing

This runbook covers the Chrome Web Store, Microsoft Edge Add-ons, and Firefox
Add-ons (AMO) releases for version `0.1.3` of **YouTube Transcript & Summary
Generator**.

## Build artifacts

From the repository root:

```sh
npm run extension:all:zip
```

Upload these files:

- Chrome: `scribix-youtube-transcript-extension-0.1.3.zip`
- Edge: `scribix-youtube-transcript-edge-extension-0.1.3.zip`
- Firefox: `scribix-youtube-transcript-firefox-extension-0.1.3.zip`
- Firefox reviewer source:
  `scribix-youtube-transcript-firefox-source-0.1.3.zip`

Generate the separate Firefox reviewer source package with:

```sh
npm run extension:firefox:source
```

Do not upload a local build. A production package must not contain `localhost`,
`ngrok`, or an insecure API URL.

The required Edge listing logo can use
`public/icons/youtube-extension.png` (512 x 512 PNG). Capture at least one
1280 x 800 screenshot of the panel working on a desktop YouTube watch page.
Do not include private account information in screenshots.

## Canonical listing information

- Name: `YouTube Transcript & Summary Generator`
- Version: `0.1.3`
- Publisher: `CENDRO LABS PTY LTD`
- Website: `https://scribix.io`
- Privacy policy: `https://scribix.io/privacy`
- Support email: `hello@scribix.io`
- Suggested category: Productivity
- Paid functionality: AI summary generation requires a Scribix Pro account.

### Short description

Generate YouTube transcripts on desktop watch pages, with AI summaries for
Scribix Pro users.

### Full description

YouTube Transcript & Summary Generator adds a focused transcript panel to
desktop YouTube watch pages.

Use it to retrieve an available caption track, read the transcript alongside
the video, jump to a timestamp, and download the result as TXT, SRT, VTT, or
CSV. Recently retrieved transcripts are cached locally for faster repeat
visits.

Transcript generation is available without a paid subscription, subject to
the displayed daily limit. AI summary generation requires an active Scribix
Pro account. Scribix imports available YouTube captions; it does not download
the YouTube video or audio and cannot create a transcript when no caption
track is available.

The extension runs only on desktop YouTube watch pages. It does not replace
the new-tab page, change search settings, show ads, or execute remotely hosted
code.

Privacy policy: https://scribix.io/privacy

### Reviewer testing notes

1. Install the extension and open a public desktop YouTube watch URL that has
   captions.
2. The Scribix transcript panel appears beside the video.
3. Generate a transcript and verify timestamp seeking plus TXT, SRT, VTT, and
   CSV downloads.
4. Anonymous transcript use is limited to 10 generations per day.
5. Select AI Summary. The extension opens the Scribix sign-in flow if needed.
   Summary generation requires a paid Scribix account.
6. The extension communicates only with YouTube and `https://scribix.io`.
   All executable code is included in the package.

If reviewers must test paid summary generation, add temporary review-account
credentials to the private reviewer-notes field. Never put credentials in the
public description or this repository.

## Edge privacy answers

Use the following text in Partner Center's Privacy section.

### Single purpose

Retrieve available captions for the YouTube watch page selected by the user,
display the transcript beside the video, provide local transcript exports,
and generate an optional AI summary for Scribix Pro users.

### Permission justification

- `storage`: Stores a random abuse-prevention quota identifier, temporary login
  tokens, and up to 20 recently retrieved transcripts for up to seven days.
- `identity`: Opens Scribix's browser-managed authorization flow and returns
  the result only to the installed extension.
- YouTube host access: Runs the transcript panel on desktop YouTube watch pages
  and reads the selected watch URL and browser language preferences.
- `scribix.io` host access: Sends requested YouTube URLs to the Scribix caption
  service, checks Scribix account status, and sends caption text only when a
  user requests a Pro AI summary.

### Remote code

Select **No**. The extension calls remote APIs for data, but it does not fetch
or execute remote JavaScript or WebAssembly.

### Data usage

Disclose:

- Personally identifiable information: the signed-in Scribix user's email
  address and profile image URL are returned for the extension's account
  display.
- Location: the Scribix API processes the request IP address and stores only a
  one-way hash for abuse prevention and quota enforcement.
- Website history or browsing activity: the selected YouTube watch URL.
- Website content: available caption text sent when the user requests transcript
  or summary functionality.
- Authentication information: short-lived Scribix access tokens and a
  revocable refresh token are stored in extension-local storage. The extension
  never receives or stores the user's password or website session cookie.

The data is used only to deliver the extension's stated transcript, quota,
account, and summary functionality. It is not sold, used for advertising, or
used for unrelated credit or lending decisions.

## Chrome 0.1.2 transition

Version 0.1.3 uses dedicated extension tokens in every browser. While existing
Chrome 0.1.2 installations update, website-cookie authentication remains
available only to the published Chrome extension origin
`chrome-extension://ighgffaindjodlejiddagjlehmgglgaf`. Edge, Firefox, unpacked
extensions, and every other extension origin cannot use that compatibility
path.

## Publish to Microsoft Edge Add-ons

1. Sign in to Microsoft Partner Center with the Microsoft account that will
   own the extension.
2. Enroll that account in the Microsoft Edge program. Choose Individual or
   Company carefully; the account type cannot be changed later.
3. Create the extension entry and copy its 32-character Edge extension ID.
4. Confirm `EDGE_EXTENSION_ID` in production matches that value, migration
   `0021_extension_auth_tokens.sql` is applied, and the current application is
   deployed before verifying the Edge login flow.
5. Upload `scribix-youtube-transcript-edge-extension-0.1.3.zip`.
6. Set public availability and the desired markets.
7. Complete Properties and Privacy using the canonical information and
   answers above.
8. Add the English store listing. Paste the full description, upload
   `public/icons/youtube-extension.png`, and add the screenshot.
9. Paste the reviewer testing notes into the private certification-notes
   field. Add temporary Pro credentials only if requested or needed.
10. Resolve every package or policy warning, then publish for certification.

Official references:

- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension

## Firefox data declaration

The Firefox package requires Firefox 140 or later so Firefox can show its
built-in data-collection consent at install time. The manifest declares:

- `authenticationInfo`: short-lived Scribix access tokens and a revocable
  refresh token used to check sign-in and Pro status.
- `browsingActivity`: the selected YouTube watch URL sent for caption lookup.
- `websiteContent`: available caption text sent when the user requests
  transcript or summary functionality.

No data category is marked optional because each declared category is required
for the advertised account, transcript, or summary flow. The extension does
not collect search terms, bookmarks, financial details, health information,
location, or personal communications.

## Publish to Firefox Add-ons

1. Sign in to the AMO Developer Hub using the Mozilla account that will own
   the add-on.
2. Choose **Submit a New Add-on**, **On this site**, and public listing.
3. Upload `scribix-youtube-transcript-firefox-extension-0.1.3.zip`.
4. Select Firefox Desktop only. Do not select Firefox for Android.
5. When AMO asks whether build tools process or generate included files, select
   **Yes**. Although the JavaScript and CSS are not minified, transpiled, or
   bundled, `scripts/build-extension.mjs` generates the Firefox manifest and
   package. Upload `scribix-youtube-transcript-firefox-source-0.1.3.zip` as the
   reviewer source package.
6. Use the canonical name, summary, full description, privacy-policy URL,
   support email, and category above.
7. Mark that the add-on requires payment/non-free services because AI
   summaries require Scribix Pro; transcript and export features remain
   available without a paid subscription subject to quota.
8. Paste the reviewer testing notes. Add temporary Pro credentials only to
   the private reviewer field if needed.
9. Submit the version, then monitor validation, signing, and review messages
   in AMO and email.

Official references:

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/

## Version 0.1.3 distribution status and release checklist

As of 2026-07-28, Chrome and Firefox are published:

- Chrome Web Store:
  `https://chromewebstore.google.com/detail/youtube-transcript-summar/ighgffaindjodlejiddagjlehmgglgaf`
- Firefox Add-ons:
  `https://addons.mozilla.org/firefox/addon/scribix-youtube-transcript/`

The Edge package and production identity configuration are ready, but the Edge
listing is not public. The localized website sidebar therefore exposes Chrome
and Firefox from one **YouTube Extension** picker while keeping the typed Edge
entry hidden until its public store URL is confirmed. Website release `0.23.4`
(commit `de39200`) implements that picker. Production commit `2df9770` remains
the extension-auth baseline with migration `0021_extension_auth_tokens.sql`,
the updated privacy page, and the Partner Center Edge CRX ID configured.

- After store signing/approval, test account status, login completion,
  sign-out/revocation, transcript generation, all four
  downloads, quota errors, paid summary, light mode, and dark mode in all three
  browsers.
- Confirm the production ZIP contents contain no credentials, `.DS_Store`,
  source maps, local URLs, or unrelated repository files.
- Keep the same version across all stores. For every update, increment the
  manifest version and upload through the existing store listing rather than
  creating a new listing.
