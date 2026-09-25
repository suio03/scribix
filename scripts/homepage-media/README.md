# Homepage film and loops

`composition.jsx` is the 24-second Hero film; `artwork.jsx` holds its publishing scene and platform marks. Since v6 (2026-09-25) the Hero is built from one Pexels interview shot from three angles, with sample captions drawn in Remotion. Sources and trims are listed in [docs/homepage-media.md](../../docs/homepage-media.md#stock-footage-and-honesty-boundaries).

```sh
node scripts/homepage-media/prepare.mjs .artifacts/homepage-film/stock/hero
REMOTION_TOOLCHAIN_DIR=/path/to/remotion-project node scripts/homepage-media/render.mjs
```

Run both from the repository root. `prepare.mjs` expects the Pexels downloads for 6878732, 6883839 and 6883833 (filenames starting with the id, as Pexels names them) and writes trimmed 30 fps inputs, the Geist and caption fonts and platform icons to ignored `.artifacts/homepage-film/public/`. Requires Remotion 4.0.484, React, FFmpeg and installed Chrome; `REMOTION_BROWSER` overrides the Chrome executable. No preview service is needed; export uses a temporary renderer connection.

Delivery: `public/media/home-demo/scribix-hero-v5.mp4` and `.jpg` (poster at 1 s).

## Publishing illustration

Platform selection follows the app's `PUBLISH_PLATFORMS`: YouTube, TikTok, LinkedIn. YouTube/LinkedIn assets and TikTok path geometry are reused from the existing app. The film illustrates selected accounts → explicit publish action → submitted states. These are **not live posts**. Do not use these assets to imply completed provider acceptance, automatic publishing without consent, unsupported networks, or guaranteed delivery speed. Scheduling is not advertised in this revision.

Hero playback is automatic and has no user controls.

## Stock footage loops (v6)

`loops.jsx` defines ten 540 × 960 clip-wall cards (`wall-01`…`wall-10`) and six 1600 × 900 feature loops (`feature-selection`, `-framing`, `-captions`, `-trim`, `-cover`, `-package`), all 8 seconds except `wall-03` (7 s). Every card draws a Pexels clip through `Footage`, a focus-point crop of the normalized 16:9 source, and overlays captions with the product's template sizes, colours and positions. Wall-card crops, templates and sample cues live in `WALL_CARDS`.

1. Download the Pexels clips listed in [docs/homepage-media.md](../../docs/homepage-media.md#stock-footage-and-honesty-boundaries) and save them as `.artifacts/homepage-film/stock/<name>.mp4`, where `<name>` is the `STOCK` key in `render-loops.mjs` (`wall-01`, `feat-framing`, …) or one of `flow-source`, `use-fitness`, `use-podcast`, `use-business`.
2. Render:

```sh
REMOTION_TOOLCHAIN_DIR=/path/to/remotion-project node scripts/homepage-media/render-loops.mjs            # everything
REMOTION_TOOLCHAIN_DIR=/path/to/remotion-project node scripts/homepage-media/render-loops.mjs wall-04 feature-cover
REMOTION_TOOLCHAIN_DIR=/path/to/remotion-project node scripts/homepage-media/render-loops.mjs sections   # workflow + audience only
```

The script trims each stock clip to a silent 1920 × 1080, 30 fps copy, extracts the six cover-picker frames, bundles `loops.jsx` and renders a CRF 16 `.master.mp4`, a web `.mp4` and a poster into `.artifacts/homepage-film/loops/`. The `sections` step trims the workflow and audience clips with FFmpeg only; no overlays.

3. Review frame samples, then copy only the web files into `public/media/home-loops/`:

```sh
cd .artifacts/homepage-film/loops && cp wall-*.{mp4,jpg} feature-*.{mp4,jpg} workflow-* audience-* ../../../public/media/home-loops/ && rm -f ../../../public/media/home-loops/*.master.mp4
```

Never publish the masters (about 64 MB). Keep people unique across sections; when replacing a clip, update the source table in the docs.
