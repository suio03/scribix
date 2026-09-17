import type { RenderSpec } from "./contracts";
export const CLIP_LENGTHS = { auto: [15, 90], short: [15, 30], medium: [30, 60], long: [60, 90] } as const;
export const CAPTION_PRESETS = ["karaoke-v1", "boxed-v1", "minimal-v1", "none"] as const;
export type GenerationSettings = { length: keyof typeof CLIP_LENGTHS; captions: typeof CAPTION_PRESETS[number]; headline: boolean; framing: "auto" | "fit" };
export const DEFAULT_GENERATION: GenerationSettings = { length: "auto", captions: "karaoke-v1", headline: false, framing: "auto" };
export function parseGeneration(value: unknown): GenerationSettings {
  if (value === undefined) return { ...DEFAULT_GENERATION };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_generation_settings");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["length", "captions", "headline", "framing"].includes(k)) || !Object.hasOwn(CLIP_LENGTHS, String(v.length)) || !CAPTION_PRESETS.includes(v.captions as GenerationSettings["captions"]) || typeof v.headline !== "boolean" || !["auto", "fit"].includes(String(v.framing))) throw Error("invalid_generation_settings");
  return v as GenerationSettings;
}
export function applyGeneration(spec: RenderSpec, settings: GenerationSettings, headline: string): RenderSpec {
  return { ...spec, segments: Object.fromEntries(Object.entries(spec.segments).map(([id, s]) => [id, { ...s, framingMode: settings.framing }])), captions: { ...spec.captions, enabled: settings.captions !== "none", templateId: settings.captions === "none" ? "karaoke-v1" : settings.captions }, ...(settings.headline ? { openingTitle: { enabled: true, text: headline.slice(0, 120), durationMs: 3000, fontScale: 1, positionY: 0.22, color: "#FFFFFF" } } : {}) };
}
