// Generated from footer-links-worker. Edit the shared source, then run npm run sync:apps.
import { renderPartners } from "@/lib/partner-links-renderer";

export const dynamic = "force-dynamic";

// This app owns exactly one list. Never accept a site or upstream URL from a request.
const PARTNER_API = "https://backlink.actone.app/api/partner-links?site=scribix.io";

export async function GET() {
  try {
    const response = await fetch(PARTNER_API, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
      credentials: "omit",
    });
    if (!response.ok) throw new Error("Partner list unavailable");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid partner list");
    return Response.json({ version: 1, html: renderPartners(data) }, {
      headers: { "Cache-Control": process.env.NODE_ENV === "development" ? "no-store" : "public, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return Response.json({ version: 1, html: "" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
