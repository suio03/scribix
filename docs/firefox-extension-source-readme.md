# Scribix Firefox Extension Source

This archive contains the human-readable source and build script for version
0.1.3 of **YouTube Transcript & Summary Generator**.

The extension JavaScript and CSS are not minified, transpiled, bundled, or
obfuscated. The build script performs only these steps:

1. Copies the extension source files.
2. Confirms the production API base is `https://scribix.io`.
3. Rewrites the background declaration for Firefox.
4. Adds the fixed Gecko ID, minimum Firefox versions, and required
   data-collection declarations to `manifest.json`.
5. Runs `node --check` on `background.js` and `content.js`.
6. Creates the submission ZIP with Info-ZIP.

## Build environment

- Linux or macOS with a POSIX `find` command.
- Node.js 20 or later. The submitted package was built with Node.js 22.11.0.
- Info-ZIP `zip` 3.0.
- No npm packages, network access, environment variables, or secrets are
  required.

## Reproduce the submitted Firefox package

From the root of this extracted source archive, run:

```sh
node scripts/build-extension.mjs firefox prod --zip
```

The command produces:

```text
.extension-build/firefox/prod/
scribix-youtube-transcript-firefox-extension-0.1.3.zip
```

Compare the extracted contents of either output with the submitted extension
package. ZIP metadata such as file timestamps may differ, but the extension
files themselves should be identical.
