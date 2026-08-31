# Video workspace FFmpeg prototype

This M0 prototype exercises the renderer contract with generated media. It uses
separate input seeks for two non-contiguous source segments, applies per-segment
normalized crop positions and zoom, concatenates video and audio, burns an ASS
caption fixture, adds a brand-color overlay, applies a fixed audio chain, writes
a 1080 × 1920 H.264/AAC MP4 with `faststart`, extracts a cover, and verifies both
outputs with `ffprobe`.

The final production renderer image must include FFmpeg's `subtitles`/libass filter.
For local M0 verification only, the script can use `pango-view` to create fixed
caption PNGs when the installed FFmpeg build omits libass; the JSON result makes
that fallback explicit so it cannot be mistaken for production parity.

Run the disposable verification:

```bash
npm run prototype:video-workspace
```

Keep inspectable artifacts in an explicit directory:

```bash
npm run prototype:video-workspace -- --output-dir /tmp/scribix-video-prototype
```

The prototype accepts no Render Spec filter strings, commands, source paths, or
credentials. All FFmpeg processes use argument arrays without a shell. The M3
preview worker in `containers/video-preview/` obtains source and output URLs
from a job-scoped internal API and translates only the validated
`preview-720p-v1` contract into fixed FFmpeg arguments.
