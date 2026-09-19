# Homepage film and artwork

The 2026-09-19 v3 revision adds a fourth Hero scene for multi-platform publishing, plus six independently composed feature images. `composition.jsx` is the 24-second film; `artwork.jsx` composes the static illustrations and publishing scene. Layouts, typography and platform marks are deterministic React/Remotion elements. Fictional photos are generated separately.

```sh
node scripts/homepage-media/prepare.mjs /path/to/scribix-hero-visual/assets
REMOTION_TOOLCHAIN_DIR=/path/to/remotion-project node scripts/homepage-media/render.mjs
```

Requires Remotion 4.0.484, React, FFmpeg, installed Chrome and the app's Sharp dependency. `REMOTION_BROWSER` overrides the Chrome executable. Use `--stills` to render only images. Full source videos and intermediate PNGs stay under ignored `.artifacts/homepage-film/`. No preview service is needed; export uses a temporary renderer connection.

Delivery:
- `public/media/home-demo/scribix-hero-v5.mp4` and `.jpg`
- `public/media/home-features-v3/*.webp`
- `public/media/home-artwork/{podcast,cooking,travel,design}.webp`

## Generated source asset

Tool: built-in `image_gen` (not CLI/API fallback). One contact sheet was generated, visually inspected, split into four photographic assets and saved in the repository. Each scene represents a fictional creator. It is not a testimonial or proof of actual product output. The movie still uses the existing genuine clip exports.

Original generated file: `/Users/laughingli/.codex/generated_images/01a0b961-a2b8-7133-a3fe-d5a7ee1ba0aa/exec-cb422c48-5df3-48f5-8e84-16f335e990e9.png`. A production copy is under `.artifacts/homepage-film/generated-contact-sheet.png`. Final crops are repository delivery inputs, so future renders do not depend on the generated-images folder.

Exact generation prompt:

> Generate one cohesive photographic contact sheet asset for a video creation software website, exactly a 2 by 2 grid of four equally sized landscape photographs, no gutters, no text or logos or UI. Each quadrant is independently usable as a content thumbnail. Top left: warm terracotta podcast studio, friendly Black female host with curly hair speaking into a broadcast microphone, medium shot, cinematic warm side lighting. Top right: East Asian male cooking instructor in sage apron in bright beautiful kitchen presenting a bowl with herbs, waist up, subject centered with space around him for vertical reframing. Bottom left: young woman outdoor travel storyteller wearing blue hiking jacket on coastal overlook, expressive hands, rich teal sea and golden natural light. Bottom right: male creative educator in ivory shirt beside colorful paper and design objects in cobalt blue studio, medium shot. Fictional people, polished authentic editorial photography, varied skin tones, natural skin texture, premium video still quality. All four images have completely different composition and palette. No celebrities, no captions, no watermark. Overall 3:2 landscape canvas.

The contact-sheet boundary is at x=768 and y=494. Retain each full quadrant before applying layout-specific object-fit crops.

## Publishing illustration

Platform selection follows the app's `PUBLISH_PLATFORMS`: YouTube, TikTok, LinkedIn. YouTube/LinkedIn assets and TikTok path geometry are reused from the existing app. The film illustrates selected accounts → explicit publish action → submitted states. These are **not live posts**. Do not use these assets to imply completed provider acceptance, automatic publishing without consent, unsupported networks, or guaranteed delivery speed. Scheduling is not advertised in this revision.

The v4 movie reduces the final publishing group footprint; the v3 static illustrations remain unchanged. Hero playback is automatic and has no user controls.
