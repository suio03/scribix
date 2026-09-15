// Generated from footer-links-worker. Edit the shared source, then run npm run sync:apps.
import { renderPartners } from "@/lib/partner-links-renderer";
import { getPartners } from "@/lib/partners";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPartners();
    return Response.json({ version: 1, html: renderPartners(data) }, {
      headers: { "Cache-Control": process.env.NODE_ENV === "development" ? "no-store" : "public, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return Response.json({ version: 1, html: "" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
