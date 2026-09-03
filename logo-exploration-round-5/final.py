"""Approved direction D, as originally presented: the heavy round-terminal S.

Geometry is unchanged from the comparison sheet. This file only adds the
colour-aware symbol, the lockup, and the shared bounding box the lockup needs.
"""

from __future__ import annotations

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = Path(__file__).parent
FONT = "/Users/laughingli/Library/Fonts/Calibre-Semibold.otf"
CAP = 34.0
C = 48.0
W, RX, RY = 15.0, 14.0, 24.0
# Optical bounds of the stroked S, used to place it in the lockup.
BOX = (C - RX - W / 2, C - RY - W / 2, 2 * RX + W, 2 * RY + W)


def ess(w=W, rx=RX, ry=RY, color="currentColor") -> str:
    top, bot = C - ry, C + ry
    return (
        f'<path fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" '
        f'd="M{C + rx},{top + 6} C{C + rx},{top} {C - rx},{top} {C - rx},{C - ry * 0.28} '
        f"C{C - rx},{C + ry * 0.1} {C + rx},{C - ry * 0.1} {C + rx},{C + ry * 0.28} "
        f'C{C + rx},{bot} {C - rx},{bot} {C - rx},{bot - 6}"/>'
    )


def symbol(color="currentColor") -> str:
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" '
            f'aria-label="Scribix">{ess(color=color)}</svg>')


def wordmark(cap, x, baseline, tracking=-0.6):
    font = TTFont(FONT)
    glyphs, cmap, metrics = font.getGlyphSet(), font.getBestCmap(), font["hmtx"].metrics
    scale = cap / font["OS/2"].sCapHeight
    pen, cursor = SVGPathPen(glyphs), x
    for ch in "Scribix":
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        cursor += metrics[name][0] * scale + tracking
    return pen.getCommands(), cursor - tracking - x


def lockup(color="currentColor") -> str:
    x0, y0, bw, bh = BOX
    baseline, pad = 60.0, 8.0
    h = CAP * 1.62
    s = h / bh
    gap = CAP * 0.58
    wx = pad + bw * s + gap
    word, ww = wordmark(CAP, wx, baseline)
    total = wx + ww + pad
    ty = (baseline - CAP / 2) - h / 2 - y0 * s
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total:.1f} 96" role="img" '
            f'aria-label="Scribix">'
            f'<g transform="translate({pad - x0 * s:.2f},{ty:.2f}) scale({s:.4f})">{ess(color=color)}</g>'
            f'<path fill="{color}" d="{word}"/></svg>')


if __name__ == "__main__":
    (OUT / "final-symbol.svg").write_text(symbol() + "\n", encoding="utf-8")
    (OUT / "final-lockup.svg").write_text(lockup() + "\n", encoding="utf-8")
    print("ok")
