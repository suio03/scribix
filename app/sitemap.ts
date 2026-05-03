import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const SITE = "https://scribix.io";
const PUBLIC_PATHS = ["", "/terms", "/privacy", "/refunds"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PUBLIC_PATHS) {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) {
      languages[locale] = urlFor(locale, path);
    }
    entries.push({
      url: urlFor(routing.defaultLocale, path),
      lastModified: now,
      changeFrequency: path === "" ? "weekly" : "yearly",
      priority: path === "" ? 1 : 0.5,
      alternates: { languages },
    });
  }

  return entries;
}

function urlFor(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${SITE}${prefix}${path}`;
}
