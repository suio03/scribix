import { CROP_ZOOM_LIMITS } from "./contracts";
import type { CropSpec, RenderSpec } from "./contracts";

export type AutoFramingPlan = {
  schemaVersion: 1;
  analyzer: string;
  sourceStartMs: number;
  sourceEndMs: number;
  points: Array<{ sourceMs: number; framingMode: "fill" | "fit"; crop: CropSpec }>;
};

export function validAutoFramingPlan(value: unknown): value is AutoFramingPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as AutoFramingPlan;
  if (plan.schemaVersion !== 1 || typeof plan.analyzer !== "string" || plan.analyzer.length > 80 ||
    !Number.isFinite(plan.sourceStartMs) || plan.sourceStartMs < 0 ||
    !Number.isFinite(plan.sourceEndMs) || plan.sourceEndMs <= plan.sourceStartMs || plan.sourceEndMs - plan.sourceStartMs > 300_000 ||
    !Array.isArray(plan.points) || plan.points.length < 1 || plan.points.length > 128) return false;
  let previous = -1;
  for (const point of plan.points) {
    if (!point || !Number.isFinite(point.sourceMs) || point.sourceMs < plan.sourceStartMs ||
      point.sourceMs >= plan.sourceEndMs || point.sourceMs <= previous ||
      !["fill", "fit"].includes(point.framingMode) || !point.crop ||
      !Number.isFinite(point.crop.x) || point.crop.x < 0 || point.crop.x > 1 ||
      !Number.isFinite(point.crop.y) || point.crop.y < 0 || point.crop.y > 1 ||
      !Number.isFinite(point.crop.zoom) || point.crop.zoom < CROP_ZOOM_LIMITS.min || point.crop.zoom > CROP_ZOOM_LIMITS.max) return false;
    previous = point.sourceMs;
  }
  return plan.points[0].sourceMs === plan.sourceStartMs;
}

export function parseAutoFramingPlan(json: string | null): AutoFramingPlan | undefined {
  try {
    const value: unknown = JSON.parse(json ?? "null");
    return validAutoFramingPlan(value) ? value : undefined;
  } catch { return undefined; }
}

export function framingAt(spec: RenderSpec["segments"][string], sourceMs: number): { framingMode: "fill" | "fit"; crop: CropSpec } {
  const range = spec.framingRanges?.filter(item => item.sourceStartMs <= sourceMs).at(-1) ?? spec;
  if (range.framingMode !== "auto") return { framingMode: range.framingMode ?? "fill", crop: range.crop };
  const plan = spec.autoFraming;
  if (plan && sourceMs >= plan.sourceStartMs && sourceMs < plan.sourceEndMs) {
    const point = plan.points.filter(item => item.sourceMs <= sourceMs).at(-1);
    if (point) return point;
  }
  // Unanalyzed footage is always shown in full, including newly extended trims.
  return { framingMode: "fit", crop: { x: 0.5, y: 0.5, zoom: 1 } };
}
