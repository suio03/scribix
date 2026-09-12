import { titleGlyphWidths } from "./title-font-metrics.mjs";
/** Shared browser/FFmpeg layout. Explicit lines prevent platform-dependent wrapping. */
export function titleLayout(overlay, captionPositionY = 0.78, cover = false) {
  const text = overlay.text.trim().replace(/\s+/gu, " ");
  let fontSize = 64 * (overlay.fontScale ?? 1);
  let visible;
  do {
    const capacity = 900 / fontSize;
    visible = [];
    let line = "", width = 0;
    const advance = value => Array.from(value).reduce((sum, char) => sum + (titleGlyphWidths[char] ?? 1), 0);
    const tokens = text.match(/[\p{Script=Latin}\p{Number}]+(?:['’−-][\p{Script=Latin}\p{Number}]+)*|\s+|[^\s]/gu) ?? [];
    for (const token of tokens) {
      const pieces = advance(token) > capacity ? Array.from(token) : [token];
      for (const piece of pieces) {
        const size = advance(piece);
        if (line && width + size > capacity) { visible.push(line.trim()); line = ""; width = 0; }
        if (!line && !piece.trim()) continue;
        line += piece; width += size;
      }
    }
    if (line.trim()) visible.push(line.trim());
    if (visible.length > 5) fontSize *= 0.95;
  } while (visible.length > 5 && fontSize > 16);
  const desired = overlay.positionY ?? 0.22;
  const halfHeight = visible.length * fontSize * 1.2 / 2 / 1920;
  const y = !cover && Math.abs(desired - captionPositionY) < halfHeight + 0.12
    ? (captionPositionY >= 0.5 ? 0.2 : 0.75) : desired;
  return { lines: visible, fontSize, positionY: Math.max(halfHeight + 0.06, Math.min(0.94 - halfHeight, y)), lineHeight: fontSize * 1.2 };
}
