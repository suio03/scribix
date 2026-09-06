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

## Full local export flow

The full local flow runs the application, D1, queue consumer, dispatcher, and
render container locally. It deliberately uses the existing remote
`scribix-media` R2 bucket so the container can download retained source media
and upload final video and cover outputs exactly as it does in production.

Requirements:

- Node.js 22 and a Docker-compatible runtime
- `.dev.vars` populated from `.env.local.example`
- local D1 migrations applied with `npm run db:migrate:local`

Set `ASSEMBLYAI_COMPLETION_MODE=polling` in both `.env.local` and `.dev.vars`,
alongside the existing `ASSEMBLYAI_API_KEY`. Local status requests fetch results
directly from AssemblyAI without waiting for a webhook or the production
15-minute recovery window. No ngrok is needed. Keep the upload waiting page open
(or reopen it in the same browser tab to resume); Dashboard listings do not poll
transcription status. Existing submitted jobs with a saved AssemblyAI ID can
also recover this way without another upload.

This setting also works with `npm run dev` for transcription, but the complete
Clips export flow needs the queue and container environment below. Production
explicitly sets `ASSEMBLYAI_COMPLETION_MODE=webhook` in `wrangler.jsonc` to override
OpenNext's bundled local env defaults; local `.dev.vars` overrides it with `polling`.

Build the OpenNext Worker once, then start the complete environment:

```bash
npm run build:cloudflare
npm run dev:video-workspace
```

Open `http://localhost:3000`. Changes to application code require rebuilding
the OpenNext Worker; the dispatcher and render-container sources are watched by
Wrangler. Local rendering runs one job at a time; production permits ten jobs
from ten different users, with one active job per user across previews and exports.
Keep the workspace open when recovering a restarted local environment: authenticated
polling re-enqueues stranded jobs at most once per project every 15 seconds.
Successful result callbacks wake pending work immediately; production also runs
recovery every minute. Keep test exports inside test projects because their source and latest
final outputs are real objects in the shared remote R2 bucket.

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
first reads sentence IDs, approximate times, and spoken text to propose 0–5
candidates. Word timestamps stay in memory for exact mapping. Long transcripts
use overlapping contiguous batches without dropping source text. A separate
Terra request sees only each candidate and its ±45-second sentence context,
then accepts, adjusts,
or rejects every proposal using spoken-content completeness as a hard gate.
Titles and captions cannot repair missing context; an unrepairable candidate is
removed rather than extended beyond 45 seconds. Both API calls use strict JSON
Schema and `store: false`. Sentence mappings are not stored as extra R2 objects.

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

Automatic speaker-framing policy checks run inside the built video image:

```sh
docker run --rm --network none --entrypoint python3 \
  -v "$PWD/scripts/video-workspace:/tests:ro" \
  scribix-video-render:auto-framing /tests/test-speaker-framing.py
```

Build that local tag with `docker build -t scribix-video-render:auto-framing containers/video-preview`. The image includes pinned face and active-speaker models; see `docs/video-workspace/speaker-follow-plan.md` for real-footage verification and release limits.
