export const OFFICIAL_CHROME_EXTENSION_ID = "ighgffaindjodlejiddagjlehmgglgaf";
export const LEGACY_CHROME_EXTENSION_ORIGIN =
  `chrome-extension://${OFFICIAL_CHROME_EXTENSION_ID}`;

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, "") ||
    "https://scribix.io"
  );
}

export function extensionJson(req: Request, data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...extensionHeaders(req),
      ...(init.headers ?? {}),
    },
  });
}

export function extensionOptions(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: extensionHeaders(req),
  });
}

export function isLegacyChromeExtensionOrigin(req: Request): boolean {
  return (
    req.headers.get("origin")?.trim() ===
    LEGACY_CHROME_EXTENSION_ORIGIN
  );
}

function extensionHeaders(req: Request): HeadersInit {
  const origin = allowedOrigin(req);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
  if (isLegacyChromeExtensionOrigin(req)) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin")?.trim();
  if (!origin) return "*";
  if (isLegacyChromeExtensionOrigin(req)) {
    return origin;
  }
  if (origin === appUrl()) return origin;
  if (origin === "https://www.youtube.com" || origin === "https://youtube.com") return origin;
  return "*";
}
