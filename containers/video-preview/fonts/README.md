# Shared publishing font

Noto Sans JP, SIL Open Font License (see `OFL.txt`). `NotoSansJP-Bold.ttf` is a static weight-700 instance of the Google Fonts variable source. The browser uses the equivalent WOFF2 at `public/fonts/NotoSansJP-Bold.woff2`; title previews and FFmpeg use the same glyphs, explicit lines and timing.

Source: https://github.com/google/fonts/tree/main/ofl/notosansjp

Downloaded variable source SHA-256: `c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f`.

Built with fontTools 4.47.2, `instantiateVariableFont(font, {"wght": 700}, inplace=True, updateFontNames=True)`. Save TTF, then set `font.flavor = "woff2"` and save the browser font. `title-font-metrics.mjs` contains advance widths divided by unitsPerEm for Latin and general punctuation from that static TTF; CJK glyphs use one em. Regenerate the metrics whenever changing the font. The font is loaded only when a publishing title is shown.
