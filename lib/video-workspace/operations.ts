import type { RenderErrorCode, RenderJobKind } from "./contracts";

export const RENDER_COMPUTE_PROFILES = {
  preview: { vCpu: 1, memoryGb: 3 },
  final: { vCpu: 1, memoryGb: 3 },
} as const satisfies Record<RenderJobKind, { vCpu: number; memoryGb: number }>;

export type RenderCostRates = {
  vCpuMicrousdPerHour: number;
  memoryGbMicrousdPerHour: number;
  perJobMicrousd: number;
  model: string;
};

export function estimateRenderCost(
  kind: RenderJobKind,
  billableDurationMs: number,
  rates: RenderCostRates
): number {
  const profile = RENDER_COMPUTE_PROFILES[kind];
  const billedSeconds = Math.max(1, Math.ceil(billableDurationMs / 1_000));
  return Math.max(0, Math.round(
    rates.perJobMicrousd +
    profile.vCpu * rates.vCpuMicrousdPerHour * billedSeconds / 3_600 +
    profile.memoryGb * rates.memoryGbMicrousdPerHour * billedSeconds / 3_600
  ));
}

export function parseRenderCostRates(value: {
  VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR?: string;
  VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR?: string;
  VIDEO_RENDER_PER_JOB_MICROUSD?: string;
  VIDEO_RENDER_COST_MODEL?: string;
}): RenderCostRates | null {
  const vCpuMicrousdPerHour = Number(value.VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR);
  const memoryGbMicrousdPerHour = Number(value.VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR);
  const perJobMicrousd = Number(value.VIDEO_RENDER_PER_JOB_MICROUSD ?? "0");
  const model = value.VIDEO_RENDER_COST_MODEL?.trim();
  if (
    !Number.isFinite(vCpuMicrousdPerHour) || vCpuMicrousdPerHour <= 0 ||
    !Number.isFinite(memoryGbMicrousdPerHour) || memoryGbMicrousdPerHour <= 0 ||
    !Number.isFinite(perJobMicrousd) || perJobMicrousd < 0 ||
    !model || model.length > 80
  ) {
    return null;
  }
  return { vCpuMicrousdPerHour, memoryGbMicrousdPerHour, perJobMicrousd, model };
}

export function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

export function renderErrorCategory(errorCode: RenderErrorCode | null): string {
  if (!errorCode) return "none";
  if (["invalid_source", "unsupported_codec", "invalid_edl", "invalid_render_spec"].includes(errorCode)) {
    return "input";
  }
  if (errorCode === "asset_missing" || errorCode === "download_failed" || errorCode === "upload_failed") {
    return "storage";
  }
  if (errorCode === "provider_unavailable" || errorCode === "job_timed_out") return "provider";
  return "renderer";
}
