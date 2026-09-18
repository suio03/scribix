# TikTok podcast tutorial: source and production notes

The six-language article is public at `/guides/how-to-clip-podcasts-for-tiktok` and its locale equivalents. Publication status and verification are maintained only in the [content plan](../research/2026-09-07-blog-seo-acquisition-summary.md).

## Canonical inputs

- Article, media captions and demonstration annotations: `lib/guides/locales/*.json`.
- Routes, section IDs, ordering and media paths: `lib/guides/registry.ts`.
- Published assets: `public/media/guides/podcast-tiktok/`.
- Local original captures and rendering inputs: `.artifacts/podcast-tutorial-2026-09-18/` (git-ignored; not recoverable from Git).
- Product facts: `lib/video-workspace/access.ts`, `lib/plans.ts` and [clip workflow](../video-workspace/clip-workflow.md).

## Source and evidence boundaries

On 2026-09-18, the user authorized the signed-in localhost project and available recording for the tutorial. On 2026-09-19, the user explicitly authorized publishing the existing tutorial and media. This is not an independently verified source redistribution license; retain attribution and do not describe the recording as openly licensed.

- Project: `efb9d6a7-1f02-48f0-87d9-fad8b8d487ee`, “US Open 2026 Recap & Zverev Catching Sincaraz? | Changeover Podcast Clip”. Source: Changeover Podcast, user-provided video, 586.606 seconds, 1920×1080 with audio.
- Four existing candidates were inspected. Candidate 1, “Zverev’s calm US Open performance”, uses `00:01.663–00:59.087`. No candidate was deleted or marked rejected.
- Content, Framing and Captions panels were captured. Existing settings: Automatic follow, Karaoke punch, white text/yellow highlight. No cut, transcript correction or manual crop was applied. The output retains letterboxing; do not claim full-frame automatic cropping or an observed before/after improvement.
- The example resumes an uploaded project. Upload steps explain how readers start their own project; no fresh upload is demonstrated.
- The user asked to retain source subtitles. No additional audio transcription or caption translation was performed. No audio was sent to OpenAI. Source-language names were not given a complete audio-led editorial review.
- Final export job: `5dfbaa30-487a-4637-a572-39bf2468fc18`. The local dispatcher completed the queued job, the UI offered Download, and the output was retrieved from configured media storage. H.264, 1080×1920, 57.433 seconds, AAC audio, 18,427,382 bytes.
- The 41-second silent overview combines actual footage, gently animated screenshots and the export. It illustrates controls, not processing duration or unperformed edits. Account sidebar is excluded from the composed demonstration.
- Direct publishing to TikTok is not demonstrated. The article instructs readers to download the file and review it in TikTok separately.

## Rebuild the demonstration

Keep `01-candidates.png`, `02-content-before.png`, `03-framing.png`, `04-captions.png`, `Geist.ttf` and `exported-clip.mp4` in the local artifact directory. The original source recording is a separate user-provided file; it is not included in Git. `05-export-ready.png` is retained as export evidence.

```sh
FFMPEG_PATH=/usr/local/bin/ffmpeg python3 scripts/content/render-podcast-demo.py \
  .artifacts/podcast-tutorial-2026-09-18 '/path/to/source.mp4' --locale en
```

Requires Pillow and FFmpeg with `drawtext`. Use `--locale fr|es|it|ja|de` for translated annotations; Japanese additionally requires `--font /path/to/Japanese-capable-font`. The script reads `demo` copy from the locale dictionaries and generates scene videos, text files, `scribix-podcast-demo.mp4` and `poster.jpg`. The Japanese font path used locally is recorded in `.artifacts/japanese-font-path.txt`.

Copy the final overview and poster to their corresponding registry paths in `public/media/guides/podcast-tiktok/`. Source captions and UI captures remain unchanged. Intermediate scenes, generated annotation text, logs and duplicate delivery copies can be removed after verification; preserve original captures, font and export inputs.
