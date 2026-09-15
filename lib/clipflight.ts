import "server-only";

export function clipflightEnabled(userId: string) {
  return Boolean(process.env.CLIPFLIGHT_API_KEY && userId.trim());
}

export function tiktokPublishingEnabled() {
  return process.env.CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED === "true";
}

export async function clipflightRequest(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  if (!clipflightEnabled(userId)) return Response.json({ error: "social_publishing_unavailable" }, { status: 404 });
  // Apply the pause at the shared transport boundary, including stored submissions and retries.
  if (!tiktokPublishingEnabled()) {
    const unavailable = () => Response.json({ error: "tiktok_publishing_unavailable" }, { status: 403 });
    if (/^\/accounts\/[^/]+\/creator-info$/.test(path)) return unavailable();
    if (init.method === "POST") {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      if (path === "/connection-sessions" && body.platform === "tiktok") return unavailable();
      if (path === "/posts") {
        if (body.tiktok?.length) return unavailable();
        // Check actual account platforms even if a stale client omits TikTok settings.
        const response = await clipflightRequest(userId, "/accounts");
        if (!response.ok) return response;
        const { accounts } = await response.json() as { accounts: { id: string; platform: string }[] };
        if (!Array.isArray(body.accountIds) || !body.accountIds.length ||
            body.accountIds.some((id: string) => !accounts.some(account => account.id === id && (account.platform === "youtube" || account.platform === "linkedin")))) return unavailable();
      }
      if (/^\/posts\/[^/]+\/retry$/.test(path)) {
        const response = await clipflightRequest(userId, path.slice(0, -6));
        if (!response.ok) return response;
        const { post } = await response.json() as { post: { targets: { id: string; platform: string }[] } };
        if (!post.targets.some(target => target.id === body.targetId && (target.platform === "youtube" || target.platform === "linkedin"))) return unavailable();
      }
    }
  }
  // Pin the service and never expose its credential or provider tokens to the browser.
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${process.env.CLIPFLIGHT_API_KEY}`);
  headers.set("X-External-User-Id", userId);
  headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`https://app.clipflight.com/api/v1${path}`, {
      ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    return response;
  } catch { return Response.json({ error: "social_service_unavailable" }, { status: 502 }); }
}

export async function socialStateHash(state: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
