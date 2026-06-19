import { FREE_YOUTUBE_IMPORTS_PER_DAY } from "@/lib/plans";

export const EXTENSION_YOUTUBE_IMPORTS_PER_DAY = FREE_YOUTUBE_IMPORTS_PER_DAY;

export type ExtensionYouTubeQuotaResult =
  | { ok: true; remaining: number; cap: number }
  | { error: "youtube_quota_exceeded"; remaining: 0; cap: number };

type ExtensionQuotaScope = "client" | "ip";

type ExtensionQuotaConfig = {
  table: "youtube_extension_quotas" | "youtube_extension_ip_quotas";
  column: "client_id" | "ip_key";
};

const QUOTA_CONFIG: Record<ExtensionQuotaScope, ExtensionQuotaConfig> = {
  client: { table: "youtube_extension_quotas", column: "client_id" },
  ip: { table: "youtube_extension_ip_quotas", column: "ip_key" },
};

export async function reserveExtensionYouTubeClientImport(
  db: D1Database,
  clientId: string
): Promise<ExtensionYouTubeQuotaResult> {
  const normalizedClientId = sanitizeExtensionClientId(clientId);
  if (!normalizedClientId) return exceeded();
  return reserveExtensionYouTubeImport(db, "client", normalizedClientId);
}

export async function refundExtensionYouTubeClientImport(
  db: D1Database,
  clientId: string
): Promise<void> {
  const normalizedClientId = sanitizeExtensionClientId(clientId);
  if (!normalizedClientId) return;
  await refundExtensionYouTubeImport(db, "client", normalizedClientId);
}

export async function reserveExtensionYouTubeIpImport(
  db: D1Database,
  request: Request,
  clientId: string
): Promise<ExtensionYouTubeQuotaResult> {
  const key = await extensionIpQuotaKey(request, clientId);
  return reserveExtensionYouTubeImport(db, "ip", key);
}

export async function refundExtensionYouTubeIpImport(
  db: D1Database,
  request: Request,
  clientId: string
): Promise<void> {
  const key = await extensionIpQuotaKey(request, clientId);
  await refundExtensionYouTubeImport(db, "ip", key);
}

async function reserveExtensionYouTubeImport(
  db: D1Database,
  scope: ExtensionQuotaScope,
  quotaKey: string
): Promise<ExtensionYouTubeQuotaResult> {
  await ensureCurrentQuotaRow(db, scope, quotaKey);

  const { table, column } = QUOTA_CONFIG[scope];
  const result = await db
    .prepare(
      `UPDATE ${table}
          SET youtube_imports_used_today = youtube_imports_used_today + 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE ${column} = ?1
          AND date(period_started_at) = date('now')
          AND youtube_imports_used_today + 1 <= ?2`
    )
    .bind(quotaKey, EXTENSION_YOUTUBE_IMPORTS_PER_DAY)
    .run();

  if (!result.meta?.changes) return exceeded();

  const used = await readUsedToday(db, scope, quotaKey);
  return {
    ok: true,
    remaining: Math.max(0, EXTENSION_YOUTUBE_IMPORTS_PER_DAY - used),
    cap: EXTENSION_YOUTUBE_IMPORTS_PER_DAY,
  };
}

async function refundExtensionYouTubeImport(
  db: D1Database,
  scope: ExtensionQuotaScope,
  quotaKey: string
): Promise<void> {
  const { table, column } = QUOTA_CONFIG[scope];
  await db
    .prepare(
      `UPDATE ${table}
          SET youtube_imports_used_today = MAX(0, youtube_imports_used_today - 1),
              updated_at = CURRENT_TIMESTAMP
        WHERE ${column} = ?1
          AND date(period_started_at) = date('now')`
    )
    .bind(quotaKey)
    .run();
}

async function ensureCurrentQuotaRow(
  db: D1Database,
  scope: ExtensionQuotaScope,
  quotaKey: string
): Promise<void> {
  const { table, column } = QUOTA_CONFIG[scope];
  await db
    .prepare(
      `INSERT INTO ${table}
         (${column}, youtube_imports_used_today, period_started_at, updated_at)
       VALUES (?1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(${column}) DO NOTHING`
    )
    .bind(quotaKey)
    .run();

  await db
    .prepare(
      `UPDATE ${table}
          SET youtube_imports_used_today = 0,
              period_started_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE ${column} = ?1
          AND date(period_started_at) < date('now')`
    )
    .bind(quotaKey)
    .run();
}

async function readUsedToday(
  db: D1Database,
  scope: ExtensionQuotaScope,
  quotaKey: string
): Promise<number> {
  const { table, column } = QUOTA_CONFIG[scope];
  const row = await db
    .prepare(
      `SELECT youtube_imports_used_today
         FROM ${table}
        WHERE ${column} = ?1`
    )
    .bind(quotaKey)
    .first<{ youtube_imports_used_today: number }>();
  return row?.youtube_imports_used_today ?? EXTENSION_YOUTUBE_IMPORTS_PER_DAY;
}

async function extensionIpQuotaKey(request: Request, clientId: string): Promise<string> {
  const ip =
    request.headers.get("CF-Connecting-IP")?.trim() ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP")?.trim();
  const rawKey = ip ? `ip:${ip}` : `missing-ip:${sanitizeExtensionClientId(clientId) ?? "invalid"}`;
  return `v1:${await sha256(rawKey)}`;
}

async function sha256(value: string): Promise<string> {
  const salt = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "scribix";
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sanitizeExtensionClientId(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(trimmed)) return null;
  return trimmed;
}

function exceeded(): ExtensionYouTubeQuotaResult {
  return {
    error: "youtube_quota_exceeded",
    remaining: 0,
    cap: EXTENSION_YOUTUBE_IMPORTS_PER_DAY,
  };
}
