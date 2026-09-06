import type { RenderSpec, CropSpec } from "./contracts";

// Replace one source interval, restoring the original setting at its end.
export function replaceFramingInterval(spec: RenderSpec["segments"][string], start: number, end: number, mode: "auto" | "fill" | "fit", crop: CropSpec) {
  const ranges = spec.framingRanges ?? [];
  const after = ranges.filter(range => range.sourceStartMs <= end).at(-1) ?? spec;
  return { ...spec, framingRanges: [
    ...ranges.filter(range => range.sourceStartMs < start || range.sourceStartMs > end),
    { sourceStartMs: start, framingMode: mode, crop: { ...crop } },
    { sourceStartMs: end, framingMode: after.framingMode ?? "fill", crop: { ...after.crop } },
  ].sort((a, b) => a.sourceStartMs - b.sourceStartMs) };
}
