export function videoWorkspaceEnabledForUser(userId: string, environment?: unknown): boolean {
  const pilots = configValue(environment, "VIDEO_WORKSPACE_PILOT_USER_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (pilots.includes(userId)) return true;
  const configured = configValue(environment, "VIDEO_WORKSPACE_ROLLOUT_PERCENT");
  const defaultPercent = process.env.NODE_ENV === "production" ? 0 : 100;
  const parsed = configured ? Number(configured) : defaultPercent;
  const percent = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
  return stableBucket(userId) < percent;
}

export function stableBucket(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function configValue(environment: unknown, key: string): string {
  if (environment && typeof environment === "object") {
    const value = (environment as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return process.env[key] ?? "";
}
