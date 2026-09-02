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

## Cloudflare Containers POC benchmark

The POC benchmark runs the production final-render path against an explicit
local source without copying the source into the repository. It produces 15s,
30s, and three-segment 45s vertical outputs, including captions and audio
normalization. The JSON report records technical media metadata and timing only;
it excludes the source name, source content, caption content, and user data.

Run it inside the video-render image with Cloudflare's initial resource target:

```bash
docker run --rm --cpus=1 --memory=3g --network=none \
  --user 501:20 \
  -v /absolute/source.mp4:/input/source.mp4:ro \
  -v /absolute/output:/output \
  -v /absolute/scribix:/workspace:ro \
  --entrypoint node scribix-video-render:cloudflare-poc \
  /workspace/scripts/video-workspace/cloudflare-container-poc.mjs \
  --source /input/source.mp4 --output-dir /output
```

Local Apple Silicon timings are functional evidence only because Cloudflare
Containers execute `linux/amd64`. Use the same cases on a deployed Container for
the actual performance and cost decision.

## Smart reframe POC

The smart-reframe path samples candidate segments with MediaPipe Face Detector,
selects dynamic crop keyframes only for a stable single primary face, falls back
to a blurred 9:16 fit when crop safety fails, and renders with FFmpeg. Run it in
the POC image so the pinned MediaPipe package and model are available:

```bash
docker run --rm --cpus=1 --memory=3g \
  --entrypoint node \
  -v /absolute/scribix:/workspace:ro \
  -v /absolute/source.mp4:/data/source.mp4:ro \
  -v /absolute/output:/output \
  scribix-video-poc:mediapipe \
  /workspace/scripts/video-workspace/smart-reframe-poc.mjs \
  --source /data/source.mp4 --output-dir /output
```

The remote runner automatically switches sources above 90 MiB to authenticated
64 MiB R2 multipart uploads. It requires `VIDEO_POC_TOKEN`, the isolated POC
Worker URL, a source path, and an output directory. The runner deletes its R2
source, outputs, report, and job container in `finally` after downloading the
verification artifacts.

## Transcript-to-final completeness POC

The completeness POC reuses a locally saved word-timestamp transcript. Terra
first proposes 0–5 candidates, then a separate Terra request accepts, adjusts,
or rejects every proposal using spoken-content completeness as a hard gate.
Titles and captions cannot repair missing context; an unrepairable candidate is
removed rather than extended beyond 45 seconds. Both API calls use strict JSON
Schema and `store: false`.

Bundle and run the analysis without uploading the source video or audio again:

```bash
npx esbuild scripts/video-workspace/completeness-poc.ts \
  --bundle --platform=node --format=esm --target=node22 \
  --outfile=/tmp/scribix-completeness-poc.mjs

node --env-file=.env.local /tmp/scribix-completeness-poc.mjs \
  --source /absolute/source.mkv \
  --transcript /absolute/transcript.json \
  --output-dir /tmp/scribix-completeness-poc
```

The output contains the first-pass candidates, every independent review
decision, final word-aligned candidates, token usage, and transcript excerpts
for local editorial inspection. It never logs transcript content.
