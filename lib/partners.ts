// Generated from footer-links-worker. Edit the shared source, then run npm run sync:apps.
import { prepareLinks } from "@/lib/partner-links-renderer";

// This application always reads its own public list, never a caller-supplied site.
const PARTNER_API = "https://backlink.actone.app/api/partner-links?site=scribix.io";

export async function getPartners() {
  const response = await fetch(PARTNER_API, {
    ...(process.env.NODE_ENV === "development"
      ? { cache: "no-store" as const }
      : { next: { revalidate: 300 } }),
    signal: AbortSignal.timeout(5000),
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Partner list unavailable");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid partner list");
  return prepareLinks(data);
}
