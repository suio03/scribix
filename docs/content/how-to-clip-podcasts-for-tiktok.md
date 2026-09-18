# How to Clip Podcasts for TikTok

Publication approved · 2026-09-19 · Six-language article; original English-language recording.

Status: copy prepared; on 2026-09-18 the user's existing localhost:3000 project was inspected, screenshots captured and a fresh final export completed. The local Guide now embeds the 41-second demonstration, four enlarged-link screenshots, and the playable/downloadable 57-second export. Delivery assets are under `public/media/guides/podcast-tiktok/`; source captures stay in `.artifacts/`. A new upload, editorial correction example and public-use rights have not been established by this session. On 2026-09-19 the user explicitly requested publication of this tutorial with its existing materials; the article is now included in the public Guides registry and sitemap. This authorization does not constitute an independently verified footage license. Production status stays in the [content plan](../research/2026-09-07-blog-seo-acquisition-summary.md).

Intended route: `/guides/how-to-clip-podcasts-for-tiktok`.

Meta description: Learn how to choose a complete podcast moment, refine its vertical framing and captions, and export a clip for TikTok with Scribix.

## Article copy

The complete copy is maintained in [`lib/guides/locales/en.json`](../../lib/guides/locales/en.json) and rendered by the shared article template. Public route: `/guides/how-to-clip-podcasts-for-tiktok`, with FR/ES/IT/JA/DE equivalents. Production routes, index eligibility and sitemap inclusion are verified during release.

## Evidence to capture before publication

These are editorial production notes, not public article copy. Fill the article with real observations and examples after the walkthrough; do not publish empty image slots or this checklist as if it were proof.

| Capture | What it needs to demonstrate |
| --- | --- |
| Source and rights record | Source title, license or owner permission, full recording available with sound; attribution requirements |
| Upload | Actual selected file and the live workflow, with private account details excluded |
| Candidate selection | A real chosen candidate, its source range, why it was kept, and any rejected alternative |
| Boundary correction | Original and revised cut, recovered context, exact spoken words; no invented dialogue |
| Vertical composition | Before/after crop and any remaining limitation; review camera changes throughout |
| Captions | A real correction if one is needed, actual style and readable output; do not manufacture an error |
| Export | Downloaded final file opened with sound; version, dimensions and duration recorded |

Product labels and plan wording must be checked against the actual environment used for the walkthrough. Local development changes do not prove production availability. If a step fails, record and resolve it or narrow the guide; do not imply it succeeded.

## Demonstration script

1. Show a short source excerpt with the conversation audible and the source credited.
2. Show the selected candidate and explain its complete idea in one sentence.
3. Show the most useful real correction, such as recovering the opening context or reframing a camera change.
4. Show caption review briefly, then play the actual exported result.
5. End with the checklist and an invitation to upload an owned recording.

Record actual stages rather than claiming a fixed processing time. If waiting is edited out, label the time compression. Any excerpt of the recording must retain the required attribution.

## Product-fact sources

- `lib/video-workspace/access.ts`: free versus paid editing access.
- `lib/plans.ts`: canonical processing allowance and storage facts; numerical allowances are omitted here to avoid duplicated constants.
- `docs/video-workspace/clip-workflow.md`: local selection and review workflow; not deployment proof.
- `docs/homepage-media.md`: source licensing and proof-versus-illustration boundaries.
- `docs/research/2026-09-07-blog-seo-acquisition-summary.md`: established English search intent and content boundaries.

## Local capture record — 2026-09-18

- User authorized using the signed-in app at `localhost:3000` and available material. Reused project `efb9d6a7-1f02-48f0-87d9-fad8b8d487ee`, “US Open 2026 Recap & Zverev Catching Sincaraz? | Changeover Podcast Clip”. Source file is 586.606 seconds, 1920×1080, with audio. This records user-provided material for local review, not a public redistribution license.
- Four existing candidates were inspected. Captured candidate 1, “Zverev’s calm US Open performance”, source range `00:01.663–00:59.087`. Kept this as a bounded discussion of composure; the other candidates address tactics, other players and relatability. No candidate was deleted or marked rejected.
- Captured Content, Framing and Captions panels. Existing settings: Automatic follow, Karaoke punch, white text/yellow highlight. No cut, transcript correction or manual crop was fabricated or applied. The preview has visible letterboxing; do not describe this as a verified full-frame automatic crop or before/after improvement. Names in the transcript still need audio-led editorial review.
- Clicked Download. Job `5dfbaa30-487a-4637-a572-39bf2468fc18` initially remained queued because no local render consumer was running. Started the existing local dispatcher temporarily on port 3002 and triggered its scheduled recovery; the job completed and the UI displayed the Download link. Port 3000 was preserved; port 3001 was not started. Download was clicked in the UI; the completed object was also retrieved using the project's configured media storage for deterministic local editing.
- Final file: H.264, 1080×1920, 57.433 seconds, AAC audio, 18,427,382 bytes. Technical audio presence is verified; no claim of a complete listening/editorial pass.
- Local artifacts: `.artifacts/podcast-tutorial-2026-09-18/` (git-ignored): original captures, `exported-clip.mp4`, `scribix-podcast-demo.mp4`, `poster.jpg`. The 41-second demonstration is silent, 1920×1080, 30 fps, combining real source footage, cropped screenshots with gentle zoom, and the actual exported clip. It illustrates review controls, not an unperformed correction. Account sidebar is excluded from the composed video.
- Rebuild with `FFMPEG_PATH=/usr/local/bin/ffmpeg python3 scripts/content/render-podcast-demo.py .artifacts/podcast-tutorial-2026-09-18 '/path/to/source.mp4'`. Requires FFmpeg with `drawtext`, the saved captures, Geist.ttf, and the actual export. Media delivery files are staged in the working tree for the Guide; no commit or public deployment has been performed.

Publication scope confirmed on 2026-09-19: retain the existing demonstration and original subtitles as requested. The article must not claim a fresh upload, a performed correction, or a full audio/name review. The previous draft guard is removed following the user’s explicit publication request.

Guide integration validation: production Next.js build passed; Chrome ai-publisher verified both embedded videos play (41.0s overview / 57.433s export), all four screenshots load, and the 390px layout has no horizontal overflow. The original development-only article guard remains in place.


Localization update: after the user clarified that source captions do not need translation, audio review/transcription was stopped. No audio was sent to OpenAI; the rejected request never ran. The local ASR package was installed but no recognition job or model download was started. The original export remains unchanged. FR/ES/IT/JA/DE versions adapt the article, checklist, landing page, navigation and demonstration annotations using the language evidence in the existing content plan. The original recording, burned-in captions and interface captures remain in their source language. Locale copies live under `lib/guides/locales/`; structure and media live in `registry.ts`. Localized demonstrations are generated with `--locale` and, for Japanese, `--font` pointing to a local Japanese-capable font; neither audio nor source captions are translated.

Six-language verification: app build and dictionary parity passed; 18 published-route variants have correct canonicals/hreflang, all six tutorial previews remain development-only. Five localized overview MP4s decode fully at 41s/1080p and support byte ranges. Japanese/German mobile layouts, same-article language switching, German video playback and localized checklist controls were checked in Chrome.
