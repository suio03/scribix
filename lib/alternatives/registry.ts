import { OPUS_COMPARISON } from "./opus-clip";

// Only implemented comparisons appear in the directory, footer and sitemap.
export const ALTERNATIVES = [
  { ...OPUS_COMPARISON, label: "Opus Clip alternative" },
] as const;
